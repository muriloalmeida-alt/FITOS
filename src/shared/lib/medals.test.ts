import { describe, expect, it } from "vitest";
import { goalTenths, medalFor, nextMedal, periodOf, plannedDays, previousPeriod, thresholdTenths } from "./medals";

describe("períodos no horário de Brasília", () => {
  it("semana de segunda a domingo; domingo 23h local ainda é a mesma semana", () => {
    const sunday = new Date("2026-10-12T02:30:00Z"); // domingo 11/10, 23h30 em Brasília
    const week = periodOf("SEMANA", sunday);
    expect(week).toMatchObject({ key: "2026-10-05", start: new Date("2026-10-05T03:00:00Z"), end: new Date("2026-10-12T03:00:00Z") });
    expect(periodOf("SEMANA", new Date("2026-10-12T03:00:00Z")).key).toBe("2026-10-12");
    expect(previousPeriod(week).key).toBe("2026-09-28");
  });

  it("mês do calendário, com virada de ano", () => {
    expect(periodOf("MES", new Date("2026-11-01T02:59:00Z"))).toMatchObject({ key: "2026-10", start: new Date("2026-10-01T03:00:00Z"), end: new Date("2026-11-01T03:00:00Z") });
    expect(periodOf("MES", new Date("2027-01-01T03:00:00Z")).key).toBe("2027-01");
    expect(previousPeriod(periodOf("MES", new Date("2027-01-10T12:00:00Z"))).key).toBe("2026-12");
  });
});

describe("meta e medalhas (PDF 3, seção 08)", () => {
  it("meta: dias previstos × exercícios × 10; sem dias, 3 por semana (150 com 5 exercícios)", () => {
    const week = periodOf("SEMANA", new Date("2026-10-07T12:00:00Z"));
    expect(plannedDays(week, ["SEGUNDA", "QUARTA", "SEXTA"])).toBe(3);
    expect(goalTenths(3, 6)).toBe(1800);
    expect(goalTenths(plannedDays(week, []), 5)).toBe(1500);
    const october = periodOf("MES", new Date("2026-10-07T12:00:00Z"));
    expect(plannedDays(october, ["SEGUNDA", "QUARTA", "SEXTA"])).toBe(13);
    expect(plannedDays(october, [])).toBe(13);
  });

  it("faixas da meta 180: 90 Bronze, 135 Prata, 180 Ouro, 198 Platina", () => {
    const goal = 1800;
    expect([50, 75, 100, 110].map((percent) => thresholdTenths(goal, percent))).toEqual([900, 1350, 1800, 1980]);
    expect(medalFor(890, goal)).toBeNull();
    expect(medalFor(900, goal)).toBe("BRONZE");
    expect(medalFor(1350, goal)).toBe("PRATA");
    expect(medalFor(1800, goal)).toBe("OURO");
    expect(medalFor(1980, goal)).toBe("PLATINA");
    expect(nextMedal(1350, goal)).toEqual({ medal: "OURO", label: "Ouro", missingTenths: 450, thresholdTenths: 1800 });
    expect(nextMedal(2000, goal)).toBeNull();
    expect(medalFor(100, 0)).toBeNull();
  });
});
