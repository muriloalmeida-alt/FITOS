/// Chaves das novas features (Fase 0): cada uma entra desligada e só liga
/// por ambiente, `FEATURE_<NOME>=on` (ex.: `FEATURE_RETROATIVO=on`). Assim
/// o código chega à main antes da validação em homologação, sem mudar nada
/// para quem usa. Só no servidor: o cliente recebe o resultado por props.
export const FEATURES = ["RETROATIVO", "GAMIFICACAO", "CUPONS", "FUNCIONAL"] as const;
export type Feature = (typeof FEATURES)[number];

export function featureEnabled(feature: Feature, env: Record<string, string | undefined> = process.env): boolean {
  return env[`FEATURE_${feature}`]?.trim().toLowerCase() === "on";
}

/// Todas de uma vez, para a página repassar ao cliente.
export function enabledFeatures(env: Record<string, string | undefined> = process.env): Record<Feature, boolean> {
  return Object.fromEntries(FEATURES.map((feature) => [feature, featureEnabled(feature, env)])) as Record<Feature, boolean>;
}
