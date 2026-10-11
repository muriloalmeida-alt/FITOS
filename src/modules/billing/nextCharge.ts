/// Próxima cobrança da assinatura FitOS (FIT-150; EPIC-34 para os avisos):
/// fim do teste grátis ou o próximo aniversário do ciclo a partir dele (ou
/// da contratação). Planos gratuitos e assinaturas canceladas não têm.
/// `from` é o instante de referência: a cobrança devolvida é a primeira em
/// ou depois dele. `freeUntil`: fim da gratuidade concedida pelo
/// administrador; quando vai além do teste, a cobrança começa nele.
export function nextChargeDate(
  subscription: { status: string; createdAt: Date; trialEndsAt: Date | null; plan: { priceCents: number; billingCycle: "MENSAL" | "ANUAL" } },
  from: Date,
  freeUntil: Date | null = null
): Date | null {
  if (subscription.status === "CANCELADA" || subscription.plan.priceCents <= 0) return null;
  const anchor = freeUntil && (!subscription.trialEndsAt || freeUntil > subscription.trialEndsAt) ? freeUntil : subscription.trialEndsAt;
  if (anchor && anchor >= from) return anchor;
  const step = subscription.plan.billingCycle === "ANUAL" ? 12 : 1;
  const next = new Date(anchor ?? subscription.createdAt);
  while (next < from) next.setMonth(next.getMonth() + step);
  return next;
}
