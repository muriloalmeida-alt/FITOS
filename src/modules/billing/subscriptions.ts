import "server-only";
import type { Plan, PrismaClient, SaasSubscription, TenantType } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { getPlanById } from "./plans";
import {
  AsaasApiError,
  cancelAsaasSubscription,
  createAsaasCustomer,
  createAsaasSubscription,
  findAsaasCustomerByCpfCnpj,
  updateAsaasSubscription,
  type AsaasBillingCycle,
} from "./asaasClient";

export type SaasSubscriptionWithPlan = SaasSubscription & { plan: Plan };

/// Enquanto a ligação real ao Asaas (FIT-128) não tiver sucesso para este
/// tenant — todo tenant `INDIVIDUAL` hoje, qualquer plano de preço zero,
/// ou qualquer falha na tentativa de melhor esforço abaixo —
/// `SaasSubscription.provider` precisa mesmo assim de um valor — este
/// sentinela documenta essa lacuna explicitamente, nunca um nome de
/// provedor fictício.
export const NO_PAYMENT_PROVIDER = "sem_integracao";

/// Único provedor real ligado até agora (FIT-128) — nunca fabricado, só
/// gravado quando `tryEnsureAsaasSubscription` de fato criar/atualizar o
/// cliente e a assinatura no Asaas com sucesso.
export const ASAAS_PROVIDER = "asaas";

const ASAAS_LOG_PREFIX = "[FIT-128][assinatura-asaas]";

function mapBillingCycleToAsaas(cycle: "MENSAL" | "ANUAL"): AsaasBillingCycle {
  return cycle === "ANUAL" ? "YEARLY" : "MONTHLY";
}

export interface AsaasWiringDeps {
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

interface AsaasWiringResult {
  provider: string;
  externalCustomerId: string | null;
  externalSubscriptionId: string | null;
}

/// Liga a assinatura local a um cliente/assinatura reais no Asaas — em
/// modo de **melhor esforço**: qualquer falha (rede, resposta de erro,
/// chave ausente, CPF/CNPJ ainda não informado) é logada de forma saneada
/// (nunca a chave, nunca o corpo completo) e a função sempre devolve o
/// fallback (`NO_PAYMENT_PROVIDER`, ids preservados) — **nunca lança**,
/// nunca bloqueia `subscribeTenantToPlan`. Decisão deliberada: os métodos
/// de escrita do Asaas (`createAsaasCustomer` em diante) nunca foram
/// exercidos contra a API real, só a leitura (diagnóstico da FIT-128) —
/// tornar o cadastro de um novo Personal/Individual dependente, de forma
/// bloqueante, de uma API externa ainda não comprovada seria repetir
/// exatamente o erro que este projeto sempre evitou (integração no
/// escuro). A confirmação real (mesmo padrão do diagnóstico: ler os logs
/// de homologação) é o próximo passo, não uma suposição feita aqui.
///
/// Só tenta a ligação real quando `plan.priceCents > 0` (nada a cobrar
/// num plano gratuito) e o tenant já informou CPF/CNPJ — `PersonalProfile`
/// (FIT-128) ou `IndividualProfile` (FIT-128, extensão ao FitOS Livre,
/// já que `individual-livre-v2` também é um plano pago real).
/// `billingType: "UNDEFINED"` deixa o Asaas oferecer Pix, cartão de
/// crédito e carteiras digitais a cada cobrança, conforme habilitado na
/// conta — decisão de Murilo, nunca um único meio fixo.
async function tryEnsureAsaasSubscription(params: {
  tenantType: TenantType;
  tenantId: string;
  plan: Plan;
  existing: SaasSubscription | null;
  trialEndsAt: Date | null;
  client: PrismaClient;
  deps: AsaasWiringDeps;
}): Promise<AsaasWiringResult> {
  const fallback: AsaasWiringResult = {
    provider: NO_PAYMENT_PROVIDER,
    externalCustomerId: params.existing?.externalCustomerId ?? null,
    externalSubscriptionId: params.existing?.externalSubscriptionId ?? null,
  };

  if (params.plan.priceCents <= 0) {
    return fallback;
  }

  const apiKey = params.deps.apiKey ?? process.env.API_ASAAS;
  if (!apiKey) {
    return fallback;
  }
  const config = { apiKey, fetchImpl: params.deps.fetchImpl };

  try {
    const [tenant, profile] = await Promise.all([
      params.client.tenant.findUniqueOrThrow({ where: { id: params.tenantId } }),
      params.tenantType === "PERSONAL"
        ? params.client.personalProfile.findUnique({ where: { tenantId: params.tenantId } })
        : params.client.individualProfile.findUnique({ where: { tenantId: params.tenantId } }),
    ]);
    if (!profile?.cpfCnpj) {
      console.log(`${ASAAS_LOG_PREFIX} pulado: CPF/CNPJ ainda não informado para este tenant.`);
      return fallback;
    }
    const cpfCnpj = profile.cpfCnpj;

    let customerId = fallback.externalCustomerId;
    if (!customerId) {
      const found = await findAsaasCustomerByCpfCnpj(config, cpfCnpj);
      customerId =
        found?.id ??
        (
          await createAsaasCustomer(config, {
            name: tenant.name,
            cpfCnpj,
            externalReference: params.tenantId,
          })
        ).id;
    }

    const cycle = mapBillingCycleToAsaas(params.plan.billingCycle);
    const value = params.plan.priceCents / 100;
    let subscriptionId = fallback.externalSubscriptionId;
    if (subscriptionId) {
      await updateAsaasSubscription(config, subscriptionId, {
        billingType: "UNDEFINED",
        value,
        cycle,
        description: params.plan.name,
      });
    } else {
      const now = new Date();
      const nextDueDate = params.trialEndsAt && params.trialEndsAt > now ? params.trialEndsAt : now;
      const created = await createAsaasSubscription(config, {
        customer: customerId,
        billingType: "UNDEFINED",
        value,
        cycle,
        nextDueDate: nextDueDate.toISOString().slice(0, 10),
        description: params.plan.name,
        externalReference: params.tenantId,
      });
      subscriptionId = created.id;
    }

    console.log(`${ASAAS_LOG_PREFIX} sucesso: cliente e assinatura ligados ao Asaas Sandbox.`);
    return { provider: ASAAS_PROVIDER, externalCustomerId: customerId, externalSubscriptionId: subscriptionId };
  } catch (error) {
    if (error instanceof AsaasApiError) {
      console.error(
        `${ASAAS_LOG_PREFIX} falha: kind=${error.kind} status=${error.status ?? "-"} codigo=${error.codigo ?? "-"} mensagem=${error.message}`
      );
    } else {
      console.error(`${ASAAS_LOG_PREFIX} falha inesperada ao tentar ligar ao Asaas.`);
    }
    return fallback;
  }
}

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
  client: PrismaClient = prisma,
  deps: AsaasWiringDeps = {}
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

  const existing = await client.saasSubscription.findUnique({ where: { tenantId: input.tenantId } });
  /// BK-18 (FIT-150): assinar de novo depois de cancelar. A assinatura do
  /// Asaas foi cancelada junto (e o cartão estava ligado a ela), então
  /// nunca é reaproveitada: a ligação cria uma nova e o cartão é pedido de
  /// novo. O teste grátis continua não se repetindo (`trialUsedAt`).
  const reactivating = existing?.status === "CANCELADA";
  const now = new Date();
  const grantsNewTrial = plan.trialDays !== null && !existing?.trialUsedAt;
  const trialEndsAt = grantsNewTrial
    ? new Date(now.getTime() + plan.trialDays! * MILLISECONDS_PER_DAY)
    : (existing?.trialEndsAt ?? null);
  const trialUsedAt = existing?.trialUsedAt ?? (grantsNewTrial ? now : null);

  /// Chamada de rede (melhor esforço) feita fora da transação — nunca
  /// dentro de `client.$transaction`, que precisa ficar curta e nunca
  /// esperar por uma API externa.
  const asaas = await tryEnsureAsaasSubscription({
    tenantType: input.tenantType,
    tenantId: input.tenantId,
    plan,
    existing: existing && reactivating ? { ...existing, externalSubscriptionId: null } : existing,
    trialEndsAt,
    client,
    deps,
  });

  return client.$transaction(async (tx) => {
    const subscription = await tx.saasSubscription.upsert({
      where: { tenantId: input.tenantId },
      create: {
        tenantId: input.tenantId,
        planId: plan.id,
        status: "ATIVA",
        provider: asaas.provider,
        externalCustomerId: asaas.externalCustomerId,
        externalSubscriptionId: asaas.externalSubscriptionId,
        trialEndsAt,
        trialUsedAt,
      },
      update: {
        planId: plan.id,
        status: "ATIVA",
        provider: asaas.provider,
        externalCustomerId: asaas.externalCustomerId,
        externalSubscriptionId: asaas.externalSubscriptionId,
        canceledAt: null,
        canceledReason: null,
        trialEndsAt,
        trialUsedAt,
        ...(reactivating ? { creditCardLast4: null, creditCardBrand: null } : {}),
      },
    });

    await tx.auditEvent.create({
      data: {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        action: reactivating ? "ASSINATURA_REATIVADA" : "ASSINATURA_CONTRATADA",
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
///
/// **Cancelamento remoto no Asaas (FIT-128), também em melhor esforço**:
/// se `externalSubscriptionId` existir, tenta cancelar no Asaas antes do
/// cancelamento local — mas o cancelamento local **sempre** acontece,
/// mesmo se a chamada remota falhar. Bloquear a capacidade do próprio
/// usuário de cancelar a assinatura por causa de uma API externa instável
/// seria pior do que uma divergência remota temporária, que a
/// conciliação (webhook, ADR-010, ainda não implementada) resolve depois.
export async function cancelSubscription(
  input: CancelSubscriptionInput,
  client: PrismaClient = prisma,
  deps: AsaasWiringDeps = {}
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

  if (current.externalSubscriptionId) {
    const apiKey = deps.apiKey ?? process.env.API_ASAAS;
    if (apiKey) {
      try {
        await cancelAsaasSubscription({ apiKey, fetchImpl: deps.fetchImpl }, current.externalSubscriptionId);
        console.log(`${ASAAS_LOG_PREFIX} sucesso: assinatura cancelada no Asaas Sandbox.`);
      } catch (error) {
        if (error instanceof AsaasApiError) {
          console.error(
            `${ASAAS_LOG_PREFIX} falha ao cancelar no Asaas: kind=${error.kind} status=${error.status ?? "-"} mensagem=${error.message}`
          );
        } else {
          console.error(`${ASAAS_LOG_PREFIX} falha inesperada ao cancelar no Asaas.`);
        }
      }
    }
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
