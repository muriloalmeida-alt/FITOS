import { describe, expect, it } from "vitest";
import { MODALITIES } from "./modalities";
import { recommendPrograms, type RecommendableProgram } from "./programRecommendation";

const p = (key: string, modalities: string[], level: RecommendableProgram["level"] = null, weeklyFrequency: number | null = 3): RecommendableProgram => ({ key, name: key, modalities, level, weeks: 4, weeklyFrequency, minutes: null });

const CATALOG = [
  p("hipertrofia", ["musculacao"], null, 4),
  p("corpo-todo", ["musculacao"], null, 2),
  p("funcional-iniciante", ["funcional"], "INICIANTE"),
  p("funcional-intermediario", ["funcional"], "INTERMEDIARIO"),
  p("crossfit-iniciante", ["crossfit"], "INICIANTE"),
  p("misto", ["musculacao", "funcional"], "INICIANTE"),
  p("sem-classificacao", []),
];
const base = { level: "INICIANTE" as const, availability: "TRES_A_QUATRO_DIAS" as const };

describe("recomendação por modalidade (proposta 11)", () => {
  it("nas sete combinações, nenhuma modalidade não escolhida entra e conteúdo sem classificação nunca entra", () => {
    for (let mask = 1; mask < 8; mask += 1) {
      const chosen = MODALITIES.filter((_, index) => mask & (1 << index));
      const { groups } = recommendPrograms(CATALOG, { ...base, modalities: chosen });
      for (const program of groups.flatMap((group) => group.programs)) {
        expect(program.modalities.every((modality) => (chosen as string[]).includes(modality))).toBe(true);
        expect(program.key).not.toBe("sem-classificacao");
      }
    }
  });

  it("várias modalidades: um grupo por modalidade; o misto só quando todas as dele foram escolhidas", () => {
    const one = recommendPrograms(CATALOG, { ...base, modalities: ["funcional"] });
    expect(one.groups.map((group) => group.modalities)).toEqual([["funcional"]]);
    const two = recommendPrograms(CATALOG, { ...base, modalities: ["musculacao", "funcional"] });
    expect(two.groups.map((group) => group.modalities)).toEqual([["musculacao"], ["funcional"], ["musculacao", "funcional"]]);
  });

  it("prioriza nível e frequência compatíveis", () => {
    const { groups } = recommendPrograms(CATALOG, { level: "INTERMEDIARIO", availability: "UM_A_DOIS_DIAS", modalities: ["musculacao", "funcional"] });
    expect(groups[0]!.programs.map((program) => program.key)).toEqual(["corpo-todo", "hipertrofia"]);
    expect(groups[1]!.programs[0]!.key).toBe("funcional-intermediario");
  });

  it("disponibilidade parcial e catálogo vazio indicam o que falta", () => {
    expect(recommendPrograms(CATALOG.filter((program) => program.key !== "crossfit-iniciante"), { ...base, modalities: ["funcional", "crossfit"] }).missing).toEqual(["crossfit"]);
    expect(recommendPrograms([], { ...base, modalities: ["crossfit"] })).toEqual({ groups: [], missing: ["crossfit"] });
  });
});
