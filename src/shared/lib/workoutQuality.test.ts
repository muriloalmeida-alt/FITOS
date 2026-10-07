import { describe, expect, it } from "vitest";
import { evaluateWorkout, type QualitySet } from "./workoutQuality";

function sets(muscle: string, count: number, exerciseId = muscle, type = "Pesos livres"): QualitySet[] {
  return Array.from({ length: count }, () => ({ muscle, type, durationSeconds: null, exerciseId }));
}

const fullWeek = ["Peitoral", "Costas", "Ombros", "Quadríceps", "Posteriores de coxa", "Glúteos", "Core"].flatMap((muscle) => sets(muscle, 3, `semana-${muscle}`));

describe("evaluateWorkout (treino avulso)", () => {
  it("treino completo e equilibrado tira 5", () => {
    const session = [...sets("Peitoral", 6, "supino"), ...sets("Costas", 6, "remada"), ...sets("Ombros", 3, "desenvolvimento")];
    const result = evaluateWorkout(session, [...fullWeek, ...session]);
    expect(result.score).toBe(5);
    expect(result.label).toBe("Treino completo");
    expect(result.worked).toEqual([
      { area: "Costas", sets: 6 },
      { area: "Peitoral", sets: 6 },
      { area: "Ombros", sets: 3 },
    ]);
    expect(result.missing).toEqual([]);
    expect(result.reasons.every((reason) => reason.ok)).toBe(true);
  });

  it("só peito: costas fica devendo e a nota cai pelo desequilíbrio", () => {
    const session = sets("Peitoral", 12, "supino");
    const result = evaluateWorkout(session, session);
    expect(result.score).toBe(4);
    expect(result.missing[0]).toEqual({ area: "Costas", reason: "Peitoral sem costas: puxar equilibra o empurrar do peito." });
    expect(result.missing.map((entry) => entry.area)).toEqual(["Costas", "Ombros", "Quadríceps"]);
    expect(result.reasons).toContainEqual({ ok: false, text: "Desequilíbrio: peitoral sem costas." });
  });

  it("poucas séries soltas tiram 1, e aeróbico e mobilidade não contam como força", () => {
    const session: QualitySet[] = [
      ...sets("Bíceps", 1, "rosca"),
      ...sets("Tríceps", 1, "triceps"),
      { muscle: "Aeróbico", type: "Aeróbico", durationSeconds: 300, exerciseId: "bike" },
      { muscle: "Mobilidade global", type: "Alongamento e mobilidade", durationSeconds: 60, exerciseId: "along" },
    ];
    const result = evaluateWorkout(session, [...fullWeek, ...session]);
    expect(result.score).toBe(1);
    expect(result.label).toBe("Leve demais");
    expect(result.cardioMinutes).toBe(5);
    expect(result.worked.map((area) => area.area)).toEqual(["Bíceps", "Tríceps"]);
    expect(result.reasons).toEqual([
      { ok: false, text: "Só 2 séries: volume baixo." },
      { ok: false, text: "2 exercícios ficaram com 1 série só." },
    ]);
  });

  it("aeróbico de 20 min conta como bom volume", () => {
    const session: QualitySet[] = [{ muscle: "Aeróbico", type: "Aeróbico", durationSeconds: 1500, exerciseId: "esteira" }];
    const result = evaluateWorkout(session, [...fullWeek, ...session]);
    expect(result.worked).toEqual([]);
    expect(result.score).toBe(4);
    expect(result.reasons[0]).toEqual({ ok: true, text: "25 min de aeróbico: bom volume." });
  });
});
