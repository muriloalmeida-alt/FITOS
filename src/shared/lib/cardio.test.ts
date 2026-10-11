import { describe, expect, it } from "vitest";
import { cardioLine, cardioPhases, nextIntensity } from "./cardio";

describe("aeróbicos", () => {
  it("linha curta e ciclo de intensidade", () => {
    expect(cardioLine(1200, "MODERADO")).toBe("20 min · moderado");
    expect(nextIntensity("MODERADO")).toBe("FORTE");
    expect(nextIntensity("INTERVALADO")).toBe("LEVE");
  });

  it("etapas somam o tempo prescrito", () => {
    for (const intensity of ["LEVE", "MODERADO", "FORTE", "INTERVALADO"] as const) {
      for (const minutes of [5, 12, 20, 24, 45]) {
        const phases = cardioPhases(minutes * 60, intensity);
        expect(phases.reduce((sum, phase) => sum + phase.seconds, 0)).toBe(minutes * 60);
        expect(phases.every((phase) => phase.seconds > 0)).toBe(true);
      }
    }
  });

  it("intervalado tem tiros de 30 s com recuperação", () => {
    const phases = cardioPhases(24 * 60, "INTERVALADO");
    expect(phases.filter((phase) => phase.kind === "hard")).toHaveLength(8);
    expect(phases[1]).toMatchObject({ label: "Tiro 1 de 8", seconds: 30 });
  });
});
