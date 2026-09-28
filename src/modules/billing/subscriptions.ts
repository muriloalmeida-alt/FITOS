import "server-only";
import type { Plan, PrismaClient, SaasSubscription, TenantType } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { getPlanById } from "./plans";

export type SaasSubscriptionWithPlan = SaasSubscription & { plan: Plan };

/// Enquanto nenhum gateway de pagamento (Asaas/Mercado Pago, FIT-091) está
/// integrado, toda assinatura é de valor zero e `SaasSubscription.provider`
/// precisa mesmo assim de um valor — este sentinela documenta essa lacuna
/// explicitamente, nunca um nome de provedor fictício.
export const NO_PAYMENT_PROVIDER = "sem_integracao";

export class SubscriptionError extends Error {
  constructor(
    public readonly kind:
      | "VALIDACAO"
      | "NAO_ENCONTRADO"
      | "PLANO_INATIVO"
      | "AUDIENCIA_INCOMPATIVEL"
      | "LIMITE_ABAIXO_DO_USO_ATUAL",
    message: string
  ) {
    super(message);
    this.name = "SubscriptionError";
  }
}

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export async function getSubscriptionForTenant(
  tenantId: string,
  client: PrismaClient = prisma
): Promise<SaasSubscriptionWithPlan | null> {
  const subscription = await client.saasSubscription.findUnique({
    where: { tenantId },
    include: { plan: true },
  });
  return subscription;
}

export interface SubscribeTenantToPlanInput {
  tenantId: string;
  tenantType: TenantType;
  planId: string;
  actorUserId: string;
}

/// Contrata ou troca o plano do tenant — mesma linha reaproveitada
/// (`SaasSubscription.tenantId` é único), nunca um novo registro. `plan.audience`
/// precisa bater com `tenantType` do contexto de autorização (nunca só a
/// escolha da UI) e o plano precisa estar `active` para nova contratação ou
/// troca — um plano retirado continua servindo quem já o assina, mas não
/// pode ser escolhido de novo. Reativa uma assinatura cancelada (troca de
/// plano após cancelamento é só uma nova contratação).
///
/// **Downgrade acima do limite** (FIT-127): rejeita a troca se o tenant já
/// tem mais alunos ativos do que o novo plano permitiria — nunca deixa um
/// tenant "invisivelmente" acima do próprio limite. Consulta `Student`
/// diretamente (contagem, não uma dependência do módulo `students`).
///
/// **Trial de 30 dias, concedido uma única vez por tenant** (FIT-127):
/// `trialUsedAt` é gravado na primeira vez que qualquer plano com
/// `trialDays` é concedido a este tenant e nunca mais é limpo — uma troca de
/// plano posterior (mesmo para outro plano com trial) nunca concede um novo
/// trial nem reinicia a contagem; `trialEndsAt` da troca é copiado do valor
/// já existente, não recalculado.
export async function subscribeTenantToPlan(
  input: SubscribeTenantToPlanInput,
  client: PrismaClient = prisma
): Promise<SaasSubscription> {
  const plan = await getPlanById(input.planId, client);
  if (!plan) {
    throw new SubscriptionError("NAO_ENCONTRADO", "Plano não encontrado.");
  }
  if (plan.audience !== input.tenantType) {
    throw new SubscriptionError("AUDIENCIA_INCOMPATIVEL", "Este plano não está disponível para o seu tipo de conta.");
  }
  if (!plan.active) {
    throw new SubscriptionError("PLANO_INATIVO", "Este plano não está mais disponível para contratação.");
  }

  if (plan.studentLimit !== null) {
    const activeStudentCount = await client.student.count({ where: { tenantId: input.tenantId, status: "ATIVO" } });
    if (activeStudentCount > plan.studentLimit) {
      throw new SubscriptionError(
        "LIMITE_ABAIXO_DO_USO_ATUAL",
        `Você tem ${String(activeStudentCount)} aluno(s) ativo(s), mas este plano permite até ${String(plan.studentLimit)}. Inative alunos ou escolha um plano com limite maior.`
      );
    }
  }

  return client.$transaction(async (tx) => {
    const existing = await tx.saasSubscription.findUnique({ where: { tenantId: input.tenantId } });
    const now = new Date();
    const grantsNewTrial = plan.trialDays !== null && !existing?.trialUsedAt;
    const trialEndsAt = grantsNewTrial
      ? new Date(now.getTime() + plan.trialDays! * MILLISECONDS_PER_DAY)
      : (existing?.trialEndsAt ?? null);
    const trialUsedAt = existing?.trialUsedAt ?? (grantsNewTrial ? now : null);

    const subscription = await tx.saasSubscription.upsert({
      where: { tenantId: input.tenantId },
      create: {
        tenantId: input.tenantId,
        planId: plan.id,
        status: "ATIVA",
        provider: NO_PAYMENT_PROVIDER,
        trialEndsAt,
        trialUsedAt,
      },
      update: {
        planId: plan.id,
        status: "ATIVA",
        provider: NO_PAYMENT_PROVIDER,
        canceledAt: null,
        canceledReason: null,
        trialEndsAt,
        trialUsedAt,
      },
    });

    await tx.auditEvent.create({
      data: {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        action: "ASSINATURA_CONTRATADA",
        entityType: "SaasSubscription",
        entityId: subscription.id,
      },
    });

    return subscription;
  });
}

export interface CancelSubscriptionInput {
  tenantId: string;
  actorUserId: string;
  reason: string;
}

/// Cancela a assinatura do tenant. Idempotente: cancelar uma já cancelada é
/// um no-op silencioso (não gera um segundo `AuditEvent`), mesma filosofia
/// de idempotência de `softDeleteAssessment`. Exige `reason` não vazio —
/// cancelamento sem motivo registrado não é aceitável para uma decisão
/// financeira, mesmo com valor zero.
export async function cancelSubscription(
  input: CancelSubscriptionInput,
  client: PrismaClient = prisma
): Promise<SaasSubscription> {
  const reason = input.reason.trim();
  if (reason.length === 0) {
    throw new SubscriptionError("VALIDACAO", "Informe o motivo do cancelamento.");
  }

  const current = await client.saasSubscription.findUnique({ where: { tenantId: input.tenantId } });
  if (!current) {
    throw new SubscriptionError("NAO_ENCONTRADO", "Nenhuma assinatura encontrada para este tenant.");
  }
  if (current.status === "CANCELADA") {
    return current;
  }

  return client.$transaction(async (tx) => {
    const canceled = await tx.saasSubscription.update({
      where: { tenantId: input.tenantId },
      data: { status: "CANCELADA", canceledAt: new Date(), canceledReason: reason },
    });

    await tx.auditEvent.create({
      data: {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        action: "ASSINATURA_CANCELADA",
        entityType: "SaasSubscription",
        entityId: canceled.id,
      },
    });

    return canceled;
  });
}
