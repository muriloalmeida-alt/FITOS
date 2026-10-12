/// Chaves das novas features (Fase 0, ADR-018). Desde 12/10/2026 (decisão
/// do produto) vêm **ligadas por padrão** no deploy; `FEATURE_<NOME>=off`
/// desliga num ambiente. As escritas no Asaas (`GRATUIDADE_ASAAS`,
/// `CUPONS_ASAAS`) ficam fora desta lista e continuam desligadas por
/// padrão. Só no servidor: o cliente recebe o resultado por props.
export const FEATURES = ["RETROATIVO", "GAMIFICACAO", "CUPONS", "FUNCIONAL"] as const;
export type Feature = (typeof FEATURES)[number];

export function featureEnabled(feature: Feature, env: Record<string, string | undefined> = process.env): boolean {
  const value = env[`FEATURE_${feature}`]?.trim().toLowerCase();
  return !value || value === "on";
}

/// Todas de uma vez, para a página repassar ao cliente.
export function enabledFeatures(env: Record<string, string | undefined> = process.env): Record<Feature, boolean> {
  return Object.fromEntries(FEATURES.map((feature) => [feature, featureEnabled(feature, env)])) as Record<Feature, boolean>;
}
