import "server-only";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";

/// Payload do webhook do Asaas para eventos de pagamento — segue o
/// contrato público documentado do Asaas v3, no mesmo espírito de cautela
/// de `asaasClient.ts`: nunca exercido contra um webhook real do Asaas
/// ainda, só contra o formato publicamente documentado. A confirmação real
/// (registrar a URL em homologação no painel do Asaas Sandbox e disparar
/// um evento de teste) é o próximo passo, não uma suposição feita aqui —
/// ver `RUNBOOK-VERIFICACAO-WEBHOOK-ASAAS-HOMOLOGACAO.md`.
export interface AsaasWebhookPayload {
  event: string;
  payment: {
    id: string;
    subscription: string | null;
    customer: string | null;
    /// Ledger SaaS (feature 5, ADR-021): opcionais, só quando o Asaas manda.
    value?: number | null;
    dueDate?: string | null;
    paymentDate?: string | null;
  };
}

/// Valida o formato mínimo esperado — nunca confia em nenhum campo do
/// corpo sem checar o tipo primeiro. `null` significa "não é um payload de
/// pagamento reconhecível", nunca lança.
export function parseAsaasWebhookPayload(raw: unknown): AsaasWebhookPayload | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  const body = raw as Record<string, unknown>;
  if (typeof body.event !== "string" || body.event.length === 0) {
    return null;
  }
  const payment = body.payment;
  if (typeof payment !== "object" || payment === null) {
    return null;
  }
  const paymentRecord = payment as Record<string, unknown>;
  if (typeof paymentRecord.id !== "string" || paymentRecord.id.length === 0) {
    return null;
  }
  const subscription = typeof paymentRecord.subscription === "string" ? paymentRecord.subscription : null;
  const customer = typeof paymentRecord.customer === "string" ? paymentRecord.customer : null;

  const value = typeof paymentRecord.value === "number" && Number.isFinite(paymentRecord.value) ? paymentRecord.value : null;
  const day = (field: unknown) => (typeof field === "string" && /^\d{4}-\d{2}-\d{2}/.test(field) ? field.slice(0, 10) : null);
  return { event: body.event, payment: { id: paymentRecord.id, subscription, customer, value, dueDate: day(paymentRecord.dueDate), paymentDate: day(paymentRecord.paymentDate ?? paymentRecord.confirmedDate) } };
}

/// Eventos que significam "este pagamento foi liquidado" — a assinatura
/// volta (ou permanece) `ATIVA`. `PAYMENT_RECEIVED_IN_CASH` é o registro
/// manual de um recebimento em dinheiro pelo próprio Asaas — incluído pela
/// mesma razão que os outros: significa que o pagamento foi liquidado.
const PAYMENT_SUCCESS_EVENTS = new Set(["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED", "PAYMENT_RECEIVED_IN_CASH"]);

/// Único evento que significa "este pagamento venceu sem ser pago" — a
/// assinatura vira `INADIMPLENTE`. Deliberadamente não inclui
/// `PAYMENT_DELETED`/`PAYMENT_REFUNDED`/outros: sem uma prova técnica real
/// de que essas transições de fato implicam inadimplência (e não, por
/// exemplo, uma cobrança cancelada por outro motivo administrativo), tratar
/// qualquer evento não mapeado como "sem mudança de estado" é a escolha
/// segura — nunca uma suposição sobre o que ainda não foi verificado.
const PAYMENT_OVERDUE_EVENTS = new Set(["PAYMENT_OVERDUE"]);

/// Estado da cobrança no ledger por evento. Pago nunca volta a pendente ou
/// vencido por um evento atrasado (só estorno muda um pagamento).
const LEDGER_STATUS: Record<string, string> = {
  PAYMENT_CREATED: "PENDENTE",
  PAYMENT_UPDATED: "PENDENTE",
  PAYMENT_CONFIRMED: "PAGO",
  PAYMENT_RECEIVED: "PAGO",
  PAYMENT_RECEIVED_IN_CASH: "PAGO",
  PAYMENT_OVERDUE: "VENCIDO",
  PAYMENT_REFUNDED: "ESTORNADO",
  PAYMENT_DELETED: "REMOVIDO",
};

/// Guarda a cobrança SaaS (feature 5, ADR-021): uma linha por `paymentId`,
/// idempotente a reenvio e tolerante a desordem.
export async function recordSaasPayment(payload: AsaasWebhookPayload, tenantId: string, status: string, client: PrismaClient = prisma): Promise<void> {
  const { payment } = payload;
  const valueCents = typeof payment.value === "number" ? Math.round(payment.value * 100) : null;
  const dueDate = payment.dueDate ? new Date(`${payment.dueDate}T12:00:00-03:00`) : null;
  const paid = status === "PAGO";
  const paidAt = paid ? (payment.paymentDate ? new Date(`${payment.paymentDate}T12:00:00-03:00`) : new Date()) : null;
  const existing = await client.saasPayment.findUnique({ where: { externalPaymentId: payment.id } });
  const keep = existing?.status === "PAGO" && (status === "PENDENTE" || status === "VENCIDO");
  const data = {
    externalSubscriptionId: payment.subscription,
    ...(valueCents !== null ? { valueCents } : {}),
    ...(dueDate ? { dueDate } : {}),
    lastEvent: payload.event,
    ...(keep ? {} : { status, ...(paid ? { paidAt: existing?.paidAt ?? paidAt } : {}) }),
  };
  await client.saasPayment.upsert({
    where: { externalPaymentId: payment.id },
    create: { tenantId, externalPaymentId: payment.id, status, paidAt, lastEvent: payload.event, externalSubscriptionId: payment.subscription, valueCents, dueDate },
    update: data,
  });
}

export type ReconcileAsaasPaymentEventOutcome =
  | "ATIVA_APLICADA"
  | "INADIMPLENTE_APLICADA"
  | "IGNORADO_SEM_MUDANCA"
  | "IGNORADO_ASSINATURA_CANCELADA_LOCALMENTE"
  | "IGNORADO_SEM_ASSINATURA_LOCAL"
  | "IGNORADO_EVENTO_NAO_TRATADO";

export interface ReconcileAsaasPaymentEventResult {
  outcome: ReconcileAsaasPaymentEventOutcome;
  tenantId: string | null;
}

/// Reconcilia o estado local (`SaasSubscription.status`) a partir de um
/// evento de pagamento real do Asaas (ADR-010, item (c)) — a peça que
/// faltava para o FitOS saber quando uma cobrança real é paga ou atrasa,
/// já que `subscribeTenantToPlan`/`cancelSubscription` (FIT-128) só criam,
/// atualizam ou cancelam a assinatura no Asaas — nunca souberam o que
/// acontece depois.
///
/// **Idempotente a reenvio**: aplicar o mesmo evento duas vezes produz o
/// mesmo estado final (`ATIVA`/`INADIMPLENTE` é sempre um `set`, nunca um
/// incremento) — reentregas do Asaas após um 5xx nunca duplicam efeito.
/// **Tolerância a desordem, parcial e documentada como limitação
/// conhecida**: uma assinatura já `CANCELADA` localmente nunca é reaberta
/// por um evento tardio (a autoridade local sempre vence, mesmo princípio
/// já usado em `cancelSubscription`) — mas entre dois eventos de pagamento
/// distintos da mesma assinatura (ex.: um `PAYMENT_OVERDUE` chegando depois
/// de um `PAYMENT_RECEIVED` mais recente, por reordenação de entrega), este
/// código aplica o que chegou por último, sem comparar datas de
/// vencimento. Não construído porque nenhum tráfego real existe ainda para
/// testar essa guarda — documentado aqui como lacuna conhecida, não como
/// comportamento correto assumido.
///
/// Busca a assinatura local por `externalSubscriptionId` (o caminho
/// esperado, já que toda assinatura real criada por `tryEnsureAsaasSubscription`
/// grava esse id) e, se o pagamento não tiver assinatura associada, cai
/// para `externalCustomerId`. Nenhuma correspondência encontrada nunca é
/// tratado como erro — pode ser um evento de uma cobrança/cliente do
/// Sandbox sem relação com o FitOS.
export async function reconcileAsaasPaymentEvent(
  payload: AsaasWebhookPayload,
  client: PrismaClient = prisma
): Promise<ReconcileAsaasPaymentEventResult> {
  const isSuccess = PAYMENT_SUCCESS_EVENTS.has(payload.event);
  const isOverdue = PAYMENT_OVERDUE_EVENTS.has(payload.event);
  const ledgerStatus = LEDGER_STATUS[payload.event];
  if (!isSuccess && !isOverdue && !ledgerStatus) {
    return { outcome: "IGNORADO_EVENTO_NAO_TRATADO", tenantId: null };
  }

  const subscription = payload.payment.subscription
    ? await client.saasSubscription.findFirst({ where: { externalSubscriptionId: payload.payment.subscription } })
    : null;
  const fallbackSubscription =
    subscription ?? (payload.payment.customer ? await client.saasSubscription.findFirst({ where: { externalCustomerId: payload.payment.customer } }) : null);

  if (!fallbackSubscription) {
    return { outcome: "IGNORADO_SEM_ASSINATURA_LOCAL", tenantId: null };
  }

  if (ledgerStatus) await recordSaasPayment(payload, fallbackSubscription.tenantId, ledgerStatus, client);
  // Só o ledger: o estado da assinatura não muda por este evento.
  if (!isSuccess && !isOverdue) {
    return { outcome: "IGNORADO_EVENTO_NAO_TRATADO", tenantId: null };
  }

  if (fallbackSubscription.status === "CANCELADA") {
    return { outcome: "IGNORADO_ASSINATURA_CANCELADA_LOCALMENTE", tenantId: fallbackSubscription.tenantId };
  }

  const newStatus = isSuccess ? "ATIVA" : "INADIMPLENTE";
  if (fallbackSubscription.status === newStatus) {
    return { outcome: "IGNORADO_SEM_MUDANCA", tenantId: fallbackSubscription.tenantId };
  }

  await client.saasSubscription.update({
    where: { tenantId: fallbackSubscription.tenantId },
    data: { status: newStatus },
  });

  return {
    outcome: newStatus === "ATIVA" ? "ATIVA_APLICADA" : "INADIMPLENTE_APLICADA",
    tenantId: fallbackSubscription.tenantId,
  };
}
