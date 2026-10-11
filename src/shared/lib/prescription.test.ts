import { describe, expect, it } from "vitest";
import { prescriptionLine } from "./prescription";

describe("prescriptionLine", () => {
  it("formata repetições, tempo e ausências", () => {
    expect(prescriptionLine({ sets: 3, reps: 12, durationSeconds: null, load: "20 kg", restSeconds: 60 })).toBe("3 × 12 · 20 kg · 60 s de descanso");
    expect(prescriptionLine({ sets: 3, reps: null, durationSeconds: 45, load: null, restSeconds: null })).toBe("3 × 45 s");
    expect(prescriptionLine({ sets: 4, reps: null, durationSeconds: null, load: null, restSeconds: null })).toBe("4 séries");
    expect(prescriptionLine({ sets: null, reps: null, durationSeconds: null, load: null, restSeconds: null })).toBe("Sem prescrição");
  });
});
