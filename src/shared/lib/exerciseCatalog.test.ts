import { describe, expect, it } from "vitest";
import { exerciseSearchText, isExerciseCategory, matchesSearch, metricLabel, normalizeSearch, worksMuscle } from "./exerciseCatalog";

const c2b = { name: "Chest-to-bar", aliases: ["C2B", "Peito na barra"], muscle: "Costas", secondaryMuscles: ["Bíceps", "Ombros"] };

describe("catálogo funcional e CrossFit", () => {
  it("busca por nome, nome alternativo e músculo, sem acento nem caixa", () => {
    expect(normalizeSearch("  Tríceps ")).toBe("triceps");
    expect(exerciseSearchText(c2b)).toBe("chest-to-bar c2b peito na barra costas biceps ombros");
    expect(matchesSearch(c2b, "c2b")).toBe(true);
    expect(matchesSearch(c2b, "PEITO NA")).toBe(true);
    expect(matchesSearch(c2b, "biceps")).toBe(true);
    expect(matchesSearch(c2b, "agachamento")).toBe(false);
    expect(matchesSearch({ name: "Agachamento livre" }, "")).toBe(true);
  });

  it("músculo vale como principal ou secundário", () => {
    expect(worksMuscle(c2b, "Costas")).toBe(true);
    expect(worksMuscle(c2b, "Ombros")).toBe(true);
    expect(worksMuscle(c2b, "Quadríceps")).toBe(false);
    expect(worksMuscle({ muscle: null }, "Core")).toBe(false);
  });

  it("categorias e métricas conhecidas", () => {
    expect(isExerciseCategory("CrossFit")).toBe(true);
    expect(isExerciseCategory("crossfit")).toBe(false);
    expect(metricLabel("REPS_LOAD")).toBe("Repetições + carga");
    expect(metricLabel("OUTRA")).toBeNull();
    expect(metricLabel(null)).toBeNull();
  });
});
