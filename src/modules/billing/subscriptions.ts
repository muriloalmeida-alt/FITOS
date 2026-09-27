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
    public readonly kind: "VALIDACAO" | "NAO_ENCONTRADO" | "PLANO_INATIVO" | "AUDIENCIA_INCOMPATIVEL",
    message: string
  ) {
    super(message);
    this.name = "SubscriptionError";
  }
}

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

  return client.$transaction(async (tx) => {
    const subscription = await tx.saasSubscription.upsert({
      where: { tenantId: input.tenantId },
      create: {
        tenantId: input.tenantId,
        planId: plan.id,
        status: "ATIVA",
        provider: NO_PAYMENT_PROVIDER,
      },
      update: {
        planId: plan.id,
        status: "ATIVA",
        provider: NO_PAYMENT_PROVIDER,
        canceledAt: null,
        canceledReason: null,
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
