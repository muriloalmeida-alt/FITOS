import { describe, expect, it } from "vitest";
import { enabledFeatures, featureEnabled } from "./features";

describe("feature flags (Fase 0)", () => {
  it("desligada por padrão; liga só com FEATURE_<NOME>=on", () => {
    expect(featureEnabled("RETROATIVO", {})).toBe(false);
    expect(featureEnabled("RETROATIVO", { FEATURE_RETROATIVO: "true" })).toBe(false);
    expect(featureEnabled("RETROATIVO", { FEATURE_RETROATIVO: " On " })).toBe(true);
    expect(enabledFeatures({ FEATURE_CUPONS: "on" })).toEqual({ RETROATIVO: false, GAMIFICACAO: false, CUPONS: true, FUNCIONAL: false });
  });
});
