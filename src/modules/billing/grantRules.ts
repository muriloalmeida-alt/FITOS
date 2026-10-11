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
/// benefício anterior). Período pago confirmado entra quando a cobrança
/// externa for integrada; até lá, conta com cobrança no provedor não é
/// elegível (ver `grantEligibility`).
export function grantWindow(trialEndsAt: Date | null, grants: GrantWindow[], days: number, now: Date): GrantWindow {
  const startsAt = freeAccessUntil(trialEndsAt, grants, now) ?? now;
  return { startsAt, endsAt: new Date(startsAt.getTime() + days * DAY_MS) };
}

/// Data local (AAAA-MM-DD) do último dia incluído: com fim exclusivo à
/// meia-noite, o último dia é o anterior.
export function lastIncludedDay(endsAt: Date): string {
  return new Date(endsAt.getTime() - 1 + SAO_PAULO_OFFSET_MS).toISOString().slice(0, 10);
}

export type GrantBlock = "SEM_ESPACO" | "SEM_ASSINATURA" | "PLANO_GRATUITO" | "COBRANCA_EXTERNA";

/// Quem pode receber: dono de espaço PERSONAL ou INDIVIDUAL (FitOS Livre)
/// com assinatura de plano pago. Conta com assinatura no Asaas só recebe
/// depois do ajuste da próxima cobrança (`nextDueDate`), para não prometer
/// gratuidade com cobrança ainda programada.
export function grantEligibility(
  role: string,
  subscription: { externalSubscriptionId: string | null; creditCardLast4: string | null; plan: { priceCents: number } } | null,
  hasTenant: boolean
): { ok: true } | { ok: false; kind: GrantBlock; message: string } {
  if ((role !== "PERSONAL" && role !== "INDIVIDUAL") || !hasTenant) {
    return { ok: false, kind: "SEM_ESPACO", message: "Só personal e FitOS Livre com espaço criado recebem gratuidade." };
  }
  if (!subscription) return { ok: false, kind: "SEM_ASSINATURA", message: "Sem assinatura: o usuário precisa escolher um plano antes." };
  if (subscription.plan.priceCents <= 0) return { ok: false, kind: "PLANO_GRATUITO", message: "O plano atual já é gratuito." };
  if (subscription.externalSubscriptionId || subscription.creditCardLast4) {
    return {
      ok: false,
      kind: "COBRANCA_EXTERNA",
      message: "Assinatura com cobrança no Asaas: a gratuidade fica disponível quando o ajuste da próxima cobrança estiver ligado.",
    };
  }
  return { ok: true };
}
