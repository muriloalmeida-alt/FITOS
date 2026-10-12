import { describe, expect, it } from "vitest";
import { enabledFeatures, featureEnabled } from "./features";

describe("feature flags (Fase 0)", () => {
  it("ligada por padrão; FEATURE_<NOME>=off desliga; definida, só \"on\" liga", () => {
    expect(featureEnabled("RETROATIVO", {})).toBe(true);
    expect(featureEnabled("RETROATIVO", { FEATURE_RETROATIVO: "" })).toBe(true);
    expect(featureEnabled("RETROATIVO", { FEATURE_RETROATIVO: " Off " })).toBe(false);
    expect(featureEnabled("RETROATIVO", { FEATURE_RETROATIVO: "true" })).toBe(false);
    expect(featureEnabled("RETROATIVO", { FEATURE_RETROATIVO: " On " })).toBe(true);
    expect(enabledFeatures({ FEATURE_CUPONS: "off" })).toEqual({ RETROATIVO: true, GAMIFICACAO: true, CUPONS: false, FUNCIONAL: true });
  });
});
