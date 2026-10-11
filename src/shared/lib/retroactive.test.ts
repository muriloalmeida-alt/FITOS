import { describe, expect, it } from "vitest";
import { durationLabel, durationSeconds, validatePerformedAt } from "./retroactive";

const now = new Date("2026-10-11T15:00:00Z");

describe("treino retroativo: prazo e duração", () => {
  it("até 7 dias atrás; nunca no futuro (com 5 min de folga para o relógio do aparelho)", () => {
    expect(validatePerformedAt(new Date("2026-10-07T21:30:00Z"), now)).toBeNull();
    expect(validatePerformedAt(new Date("2026-10-04T15:00:00Z"), now)).toBeNull();
    expect(validatePerformedAt(new Date("2026-10-04T14:59:00Z"), now)).toMatch(/até 7 dias/);
    expect(validatePerformedAt(new Date("2026-10-11T15:04:00Z"), now)).toBeNull();
    expect(validatePerformedAt(new Date("2026-10-11T15:10:00Z"), now)).toMatch(/futuro/);
    expect(validatePerformedAt(new Date("x"), now)).toMatch(/Informe/);
  });

  it("duração obrigatória, maior que zero, minutos de 0 a 59", () => {
    expect(durationSeconds(0, 45)).toBe(2700);
    expect(durationSeconds(1, 5)).toBe(3900);
    expect(durationSeconds(0, 0)).toMatch(/quanto tempo/);
    expect(durationSeconds(0, 60)).toMatch(/0 a 59/);
    expect(durationSeconds(1.5, 0)).toMatch(/0 a 23/);
    expect(durationLabel(2700)).toBe("45 min");
    expect(durationLabel(3900)).toBe("1 h 05 min");
  });
});
