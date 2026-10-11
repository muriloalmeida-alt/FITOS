import { describe, expect, it } from "vitest";
import { countedEntries, rankStudents } from "./ranking";
import { periodOf } from "./medals";

const entry = (studentId: string, iso: string, balancedTenths: number, contested = false) => ({ studentId, performedAt: new Date(iso), balancedTenths, contested });

describe("ranking da turma (modo equilibrado)", () => {
  it("1 treino por dia (o melhor) e os 3 melhores da semana", () => {
    const counted = countedEntries([
      entry("a", "2026-10-05T10:00:00Z", 90),
      entry("a", "2026-10-05T20:00:00Z", 110), // mesmo dia: fica o melhor
      entry("a", "2026-10-06T12:00:00Z", 100),
      entry("a", "2026-10-07T12:00:00Z", 80),
      entry("a", "2026-10-08T12:00:00Z", 105),
      entry("a", "2026-10-12T12:00:00Z", 100), // outra semana
    ]);
    expect(counted.map((item) => item.balancedTenths).sort((x, y) => y - x)).toEqual([110, 105, 100, 100]);
  });

  it("dia local de Brasília: 23h de domingo e 1h de segunda são dias diferentes", () => {
    expect(countedEntries([entry("a", "2026-10-12T02:00:00Z", 100), entry("a", "2026-10-12T04:00:00Z", 100)])).toHaveLength(2);
  });

  it("posições com empate e participante sem treino com zero", () => {
    const week = periodOf("SEMANA", new Date("2026-10-07T12:00:00Z"));
    const rows = rankStudents(
      ["a", "b", "c", "d"],
      [entry("a", "2026-10-05T12:00:00Z", 105), entry("b", "2026-10-06T12:00:00Z", 105, true), entry("c", "2026-10-06T12:00:00Z", 90), entry("c", "2026-09-30T12:00:00Z", 200)],
      week
    );
    expect(rows.map((row) => [row.studentId, row.position, row.pointsTenths, row.counted])).toEqual([
      ["a", 1, 105, 1],
      ["b", 1, 105, 1],
      ["c", 3, 90, 1],
      ["d", 4, 0, 0],
    ]);
    expect(rows[1]!.contested).toBe(true);
  });

  it("mês soma as semanas, cada uma com seu limite de 3", () => {
    const month = periodOf("MES", new Date("2026-10-15T12:00:00Z"));
    const days = ["05", "06", "07", "08", "12", "13"].map((day) => entry("a", `2026-10-${day}T12:00:00Z`, 100));
    expect(rankStudents(["a"], days, month)[0]).toMatchObject({ pointsTenths: 500, counted: 5 });
  });
});
