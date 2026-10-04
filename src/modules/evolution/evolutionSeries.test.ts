import { describe, expect, it } from "vitest";
import { buildEvolution } from "./evolutionSeries";

describe("buildEvolution", () => {
  it("monta as séries em ordem e as medidas da primeira para a última avaliação", () => {
    const result = buildEvolution([
      { recordedAt: new Date("2026-09-01T12:00:00Z"), weightGrams: 72400, bodyFatTenthPercent: null, measurements: [{ type: "CINTURA", valueMillimeters: 820 }, { type: "BRACO", valueMillimeters: 330 }] },
      { recordedAt: new Date("2026-07-01T12:00:00Z"), weightGrams: 75000, bodyFatTenthPercent: 210, measurements: [{ type: "CINTURA", valueMillimeters: 860 }] },
    ]);
    expect(result.series.map((entry) => [entry.key, entry.points.map((point) => point.value)])).toEqual([
      ["peso", [75, 72.4]],
      ["gordura", [21]],
      ["cintura", [86, 82]],
    ]);
    expect(result.measures).toEqual([
      { type: "CINTURA", label: "Cintura", first: 86, last: 82, delta: -4 },
      { type: "BRACO", label: "Braço", first: 33, last: 33, delta: 0 },
    ]);
  });
});
