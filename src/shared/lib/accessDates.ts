/// Datas da assinatura para o cliente (gratuidade, teste, cobrança):
/// "5 de novembro" no ano corrente e "5 de novembro de 2027" fora dele,
/// para uma gratuidade longa nunca parecer terminar este ano. Fuso de
/// São Paulo.

const TZ = "America/Sao_Paulo";
const withYear = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: TZ });
const withoutYear = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", timeZone: TZ });
const yearOf = new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: TZ });

export function accessDateLabel(date: Date, now: Date): string {
  return yearOf.format(date) === yearOf.format(now) ? withoutYear.format(date) : withYear.format(date);
}

/// Gratuidade concedida que vai além do teste grátis (ou existe sem ele):
/// é ela que o cliente precisa ver, não o teste inicial.
export function grantOutlastsTrial(trialEndsAt: Date | null, freeUntil: Date | null, now: Date): freeUntil is Date {
  if (!freeUntil || freeUntil <= now) return false;
  return !trialEndsAt || trialEndsAt <= now || freeUntil > trialEndsAt;
}
