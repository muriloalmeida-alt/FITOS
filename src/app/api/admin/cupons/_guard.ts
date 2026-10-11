import { featureEnabled } from "@/shared/config/features";

/// Cupons (feature 5) só existem com `FEATURE_CUPONS=on`.
export function couponsOff(): Response | null {
  return featureEnabled("CUPONS") ? null : Response.json({ error: "NAO_ENCONTRADO" }, { status: 404 });
}

/// Só os campos da campanha; nada de ator, estado ou versão vindo do cliente.
export function configFrom(body: Record<string, unknown>) {
  return {
    code: body.code,
    name: body.name,
    kind: body.kind,
    amount: body.amount,
    products: body.products,
    segments: body.segments,
    planIds: body.planIds,
    cycles: body.cycles,
    startsAt: body.startsAt,
    endsAt: body.endsAt,
    durationCycles: body.durationCycles,
    maxRedemptions: body.maxRedemptions,
    perAccountLimit: body.perAccountLimit,
    budgetCents: body.budgetCents,
    stackable: body.stackable,
    note: body.note,
    selectedTenantIds: body.selectedTenantIds,
  };
}
