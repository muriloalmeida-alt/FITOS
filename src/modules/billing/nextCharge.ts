/// Próxima cobrança da assinatura FitOS (FIT-150; EPIC-34 para os avisos):
/// fim do teste grátis ou o próximo aniversário do ciclo a partir dele (ou
/// da contratação). Planos gratuitos e assinaturas canceladas não têm.
/// `from` é o instante de referência: a cobrança devolvida é a primeira em
/// ou depois dele.
export function nextChargeDate(
  subscription: { status: string; createdAt: Date; trialEndsAt: Date | null; plan: { priceCents: number; billingCycle: "MENSAL" | "ANUAL" } },
  from: Date
): Date | null {
  if (subscription.status === "CANCELADA" || subscription.plan.priceCents <= 0) return null;
  if (subscription.trialEndsAt && subscription.trialEndsAt >= from) return subscription.trialEndsAt;
  const step = subscription.plan.billingCycle === "ANUAL" ? 12 : 1;
  const next = new Date(subscription.trialEndsAt ?? subscription.createdAt);
  while (next < from) next.setMonth(next.getMonth() + step);
  return next;
}
