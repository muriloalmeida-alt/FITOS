/// Renovação de gratuidade (feature 4): regras puras, sem banco. A
/// concessão é um benefício separado do teste inicial — nunca mexe em
/// `trialEndsAt`/`trialUsedAt` — e começa onde o acesso gratuito em vigor
/// termina, para não desperdiçar dias sobrepostos.
///
/// Datas: instantes em UTC, fim exclusivo. Um "dia" soma 24 h: o fuso
/// America/Sao_Paulo não tem horário de verão desde 2019, então 24 h é
/// sempre um dia de calendário local.

export const GRANT_DAY_OPTIONS = [7, 15, 30, 60, 90] as const;
export const GRANT_MAX_DAYS = 365;
export const GRANT_REASON_TEXT_MAX = 300;

export const GRANT_REASONS = {
  LANCAMENTO: "Lançamento",
  SUPORTE: "Suporte",
  PARCERIA: "Parceria",
  RETENCAO: "Retenção",
  OUTRO: "Outro",
} as const;
export type GrantReason = keyof typeof GRANT_REASONS;

const DAY_MS = 86_400_000;
const SAO_PAULO_OFFSET_MS = -3 * 3_600_000;

export interface GrantWindow {
  startsAt: Date;
  endsAt: Date;
}

export function isGrantReason(value: unknown): value is GrantReason {
  return typeof value === "string" && Object.hasOwn(GRANT_REASONS, value);
}

/// Valida dias e motivo. Devolve a mensagem de erro, ou `null` quando ok.
export function validateGrantInput(input: { days: unknown; reasonCode: unknown; reasonText: unknown }): string | null {
  if (typeof input.days !== "number" || !Number.isInteger(input.days) || input.days < 1 || input.days > GRANT_MAX_DAYS) {
    return `Informe de 1 a ${GRANT_MAX_DAYS} dias.`;
  }
  if (!isGrantReason(input.reasonCode)) return "Escolha o motivo.";
  const text = typeof input.reasonText === "string" ? input.reasonText.trim() : "";
  if (text.length > GRANT_REASON_TEXT_MAX) return `O motivo pode ter até ${GRANT_REASON_TEXT_MAX} caracteres.`;
  if (input.reasonCode === "OUTRO" && !text) return "Descreva o motivo.";
  return null;
}

/// A janela que cobre `now`, quando houver.
export function coveringGrant(grants: GrantWindow[], now: Date): GrantWindow | null {
  return grants.find((grant) => grant.startsAt <= now && now < grant.endsAt) ?? null;
}

/// Último instante de acesso gratuito já garantido daqui para frente:
/// teste em curso e benefícios ativos ou agendados. `null` se nada vai
/// além de `now`.
export function freeAccessUntil(trialEndsAt: Date | null, grants: GrantWindow[], now: Date): Date | null {
  let until: Date | null = trialEndsAt && trialEndsAt > now ? trialEndsAt : null;
  for (const grant of grants) {
    if (grant.endsAt > now && (!until || grant.endsAt > until)) until = grant.endsAt;
  }
  return until;
}

/// Janela da nova concessão: base = max(agora, fim do teste futuro, fim do
/// benefício anterior, fim do período pago confirmado no Asaas).
export function grantWindow(trialEndsAt: Date | null, grants: GrantWindow[], days: number, now: Date, paidThrough: Date | null = null): GrantWindow {
  const free = freeAccessUntil(trialEndsAt, grants, now) ?? now;
  const startsAt = paidThrough && paidThrough > free ? paidThrough : free;
  return { startsAt, endsAt: new Date(startsAt.getTime() + days * DAY_MS) };
}

/// Data local (AAAA-MM-DD) do último dia incluído: com fim exclusivo à
/// meia-noite, o último dia é o anterior.
export function lastIncludedDay(endsAt: Date): string {
  return new Date(endsAt.getTime() - 1 + SAO_PAULO_OFFSET_MS).toISOString().slice(0, 10);
}

export type GrantBlock = "SEM_ESPACO" | "SEM_ASSINATURA" | "PLANO_GRATUITO" | "COBRANCA_EXTERNA" | "COBRANCA_EMITIDA" | "ASAAS_INDISPONIVEL" | "EM_SINCRONIZACAO";

/// Quem pode receber: dono de espaço PERSONAL ou INDIVIDUAL (FitOS Livre)
/// com assinatura de plano pago. Conta com assinatura no Asaas só recebe
/// com o ajuste da próxima cobrança ligado (`asaasEnabled`), para não
/// prometer gratuidade com cobrança ainda programada. Assinatura cancelada
/// recebe só o acesso: nada a ajustar no Asaas.
export function grantEligibility(
  role: string,
  subscription: { status: string; externalSubscriptionId: string | null; creditCardLast4: string | null; plan: { priceCents: number } } | null,
  hasTenant: boolean,
  asaasEnabled = false
): { ok: true; external: boolean } | { ok: false; kind: GrantBlock; message: string } {
  if ((role !== "PERSONAL" && role !== "INDIVIDUAL") || !hasTenant) {
    return { ok: false, kind: "SEM_ESPACO", message: "Só personal e FitOS Livre com espaço criado recebem gratuidade." };
  }
  if (!subscription) return { ok: false, kind: "SEM_ASSINATURA", message: "Sem assinatura: o usuário precisa escolher um plano antes." };
  if (subscription.plan.priceCents <= 0) return { ok: false, kind: "PLANO_GRATUITO", message: "O plano atual já é gratuito." };
  if (subscription.status === "CANCELADA") return { ok: true, external: false };
  if (subscription.externalSubscriptionId && asaasEnabled) return { ok: true, external: true };
  if (subscription.externalSubscriptionId || subscription.creditCardLast4) {
    return {
      ok: false,
      kind: "COBRANCA_EXTERNA",
      message: "Assinatura com cobrança no Asaas: a gratuidade fica disponível quando o ajuste da próxima cobrança estiver ligado.",
    };
  }
  return { ok: true, external: false };
}

// ── Cobrança no Asaas (fatia 3) ────────────────────────────────────────

const PAID_STATUSES = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);
const OPEN_STATUSES = new Set(["PENDING", "OVERDUE"]);

export interface ExternalPayment {
  id: string;
  status: string;
  /// AAAA-MM-DD.
  dueDate: string;
  value: number;
}

/// Data local (AAAA-MM-DD) de um instante.
export function localDay(instant: Date): string {
  return new Date(instant.getTime() + SAO_PAULO_OFFSET_MS).toISOString().slice(0, 10);
}

/// Meia-noite local de um dia AAAA-MM-DD.
function localMidnight(day: string): Date {
  return new Date(`${day}T00:00:00-03:00`);
}

function addMonths(day: string, months: number): string {
  const [year, month, date] = day.split("-").map(Number) as [number, number, number];
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  // Fim de mês: 31/01 + 1 mês = 28 ou 29/02, nunca 03/03.
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(date, lastDay));
  return target.toISOString().slice(0, 10);
}

/// Fim do serviço já pago: cada cobrança paga cobre um ciclo a partir do
/// vencimento. `null` sem pagamento confirmado.
export function paidThroughFromPayments(payments: ExternalPayment[], cycle: "MONTHLY" | "YEARLY"): Date | null {
  let end: string | null = null;
  for (const payment of payments) {
    if (!PAID_STATUSES.has(payment.status)) continue;
    const covered = addMonths(payment.dueDate, cycle === "YEARLY" ? 12 : 1);
    if (!end || covered > end) end = covered;
  }
  return end ? localMidnight(end) : null;
}

export interface ExternalBillingPlan {
  /// Próxima cobrança ainda não gerada, hoje e depois da concessão.
  currentDueDate: string;
  targetDueDate: string;
  /// O Asaas precisa mudar (`false` quando a próxima cobrança já é depois).
  needsChange: boolean;
  /// Cobranças em aberto com vencimento dentro da janela: bloqueiam.
  openInWindow: ExternalPayment[];
  /// Atrasos anteriores à janela: só informados, continuam devidos.
  oldDebts: ExternalPayment[];
}

/// O que muda na cobrança do Asaas para a janela gratuita: a próxima
/// cobrança passa para o dia em que o benefício termina (nunca antecipa).
export function externalBillingPlan(window: GrantWindow, currentDueDate: string, payments: ExternalPayment[]): ExternalBillingPlan {
  const startDay = localDay(window.startsAt);
  const lastDay = lastIncludedDay(window.endsAt);
  const targetDueDate = localDay(window.endsAt);
  const open = payments.filter((payment) => OPEN_STATUSES.has(payment.status));
  return {
    currentDueDate,
    targetDueDate: currentDueDate > targetDueDate ? currentDueDate : targetDueDate,
    needsChange: currentDueDate < targetDueDate,
    openInWindow: open.filter((payment) => payment.dueDate >= startDay && payment.dueDate <= lastDay),
    oldDebts: open.filter((payment) => payment.status === "OVERDUE" && payment.dueDate < startDay),
  };
}
