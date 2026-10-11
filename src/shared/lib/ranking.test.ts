import { describe, expect, it } from "vitest";
import { countedEntries, rankStudents, isSeasonLength, rankSeason, seasonWindow } from "./ranking";
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

describe("temporada dos amigos", () => {
  const season = seasonWindow(new Date("2026-10-05T03:00:00Z"), 14);
  const members = [
    { memberId: "a", joinedAt: new Date("2026-10-01T00:00:00Z"), leftAt: null },
    { memberId: "b", joinedAt: new Date("2026-10-08T00:00:00Z"), leftAt: null },
    { memberId: "c", joinedAt: new Date("2026-10-01T00:00:00Z"), leftAt: new Date("2026-10-10T00:00:00Z") },
  ];
  const at = (iso: string, memberId: string, totalTenths: number, balancedTenths = totalTenths, contested = false) => ({ memberId, performedAt: new Date(iso), totalTenths, balancedTenths, contested });

  it("janela de 7, 14 ou 28 dias", () => {
    expect(season.endsAt.toISOString()).toBe("2026-10-19T03:00:00.000Z");
    expect(isSeasonLength(14)).toBe(true);
    expect(isSeasonLength(10)).toBe(false);
  });

  it("TOTAL soma dentro da temporada, depois da entrada e antes da saída; empate divide a posição", () => {
    const entries = [
      at("2026-10-04T12:00:00Z", "a", 500), // antes da temporada
      at("2026-10-06T12:00:00Z", "a", 100),
      at("2026-10-07T12:00:00Z", "b", 900), // antes de b entrar
      at("2026-10-09T12:00:00Z", "b", 100),
      at("2026-10-09T12:00:00Z", "c", 100),
      at("2026-10-11T12:00:00Z", "c", 400), // depois de c sair
      at("2026-10-20T12:00:00Z", "a", 900), // depois do fim
    ];
    expect(rankSeason("TOTAL", season, members, entries).map((row) => [row.memberId, row.position, row.pointsTenths])).toEqual([
      ["a", 1, 100],
      ["b", 1, 100],
      ["c", 1, 100],
    ]);
  });

  it("EQUILIBRADO: 1 treino por dia e 3 melhores por semana, com contestação sinalizada", () => {
    const entries = [
      at("2026-10-06T10:00:00Z", "a", 300, 80),
      at("2026-10-06T20:00:00Z", "a", 300, 90),
      at("2026-10-07T12:00:00Z", "a", 300, 100),
      at("2026-10-08T12:00:00Z", "a", 300, 110, true),
      at("2026-10-09T12:00:00Z", "a", 300, 50),
    ];
    const [first] = rankSeason("EQUILIBRADO", season, members, entries);
    expect(first).toMatchObject({ memberId: "a", pointsTenths: 300, counted: 3, contested: true });
  });
});
