import { describe, expect, it } from "vitest";
import { goalProgress, panelGoals, panelWeek } from "./panel";

// Domingo, 11/10/2026, 21h em Brasília (00h UTC de segunda).
const now = new Date("2026-10-12T00:00:00Z");
const at = (iso: string) => new Date(iso);

describe("painel do aluno", () => {
  it("semana de segunda a domingo no fuso de Brasília, com datas, feitos, hoje e faixa", () => {
    const { days, rangeLabel } = panelWeek(now, [at("2026-10-06T12:00:00Z"), at("2026-10-08T23:30:00Z"), at("2026-10-04T12:00:00Z")], ["SEGUNDA", "QUARTA"]);
    expect(rangeLabel).toBe("5 - 11 out.");
    expect(days.map((day) => day.date)).toEqual([5, 6, 7, 8, 9, 10, 11]);
    expect(days.map((day) => day.done)).toEqual([false, true, false, true, false, false, false]);
    expect(days.find((day) => day.today)?.short).toBe("DOM");
    expect(days.filter((day) => day.planned).map((day) => day.short)).toEqual(["SEG", "QUA"]);
    expect(panelWeek(at("2026-10-01T15:00:00Z"), [], []).rangeLabel).toBe("28 set. - 4 out.");
  });

  it("meta pelos dias configurados no período; sem dias, semana pela frequência e mês sem meta", () => {
    const performed = [at("2026-10-06T12:00:00Z"), at("2026-10-08T12:00:00Z"), at("2026-10-02T12:00:00Z"), at("2026-09-30T12:00:00Z")];
    expect(panelGoals(now, performed, ["SEGUNDA", "QUARTA", "SEXTA"])).toEqual({ week: { done: 2, goal: 3 }, month: { done: 3, goal: 13 } });
    expect(panelGoals(now, performed, [], 4)).toEqual({ week: { done: 2, goal: 4 }, month: { done: 3, goal: null } });
    expect(panelGoals(now, performed, [])).toEqual({ week: { done: 2, goal: null }, month: { done: 3, goal: null } });
  });

  it("percentual arredondado, barra até 100, sem dividir por zero", () => {
    expect(goalProgress({ done: 2, goal: 3 })).toEqual({ percent: 67, bar: 67 });
    expect(goalProgress({ done: 5, goal: 4 })).toEqual({ percent: 125, bar: 100 });
    expect(goalProgress({ done: 2, goal: 0 })).toBeNull();
    expect(goalProgress({ done: 2, goal: null })).toBeNull();
  });
});
