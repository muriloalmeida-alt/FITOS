import { describe, expect, it } from "vitest";
import { BlockError, blockSummary, groupByBlock, parseBlock, parseBlocks, readBlocks } from "./workoutBlocks";

describe("blocos do treino", () => {
  it("cada formato exige o que o define e descarta o que não se aplica", () => {
    expect(parseBlock({ key: "b1", kind: "CIRCUITO", rounds: 3, windowSeconds: 600, restSeconds: 60 })).toMatchObject({ rounds: 3, windowSeconds: null, restSeconds: 60 });
    expect(parseBlock({ key: "b2", kind: "AMRAP", windowSeconds: 600, rounds: 5 })).toMatchObject({ windowSeconds: 600, rounds: null });
    expect(parseBlock({ key: "b3", kind: "EMOM", intervals: 12 })).toMatchObject({ intervals: 12, intervalSeconds: 60 });
    expect(parseBlock({ key: "b4", kind: "FOR_TIME" })).toMatchObject({ rounds: null, timeCapSeconds: null });
    expect(() => parseBlock({ key: "b1", kind: "CIRCUITO" })).toThrow(BlockError);
    expect(() => parseBlock({ key: "b1", kind: "AMRAP" })).toThrow("janela");
    expect(() => parseBlock({ key: "b1", kind: "EMOM", intervals: 0 })).toThrow(BlockError);
    expect(() => parseBlock({ key: "B 1", kind: "AMRAP", windowSeconds: 600 })).toThrow(BlockError);
    expect(() => parseBlock({ key: "b1", kind: "WOD" })).toThrow(BlockError);
  });

  it("lista sem chave repetida e leitura tolerante do banco", () => {
    expect(() => parseBlocks([{ key: "b1", kind: "FOR_TIME" }, { key: "b1", kind: "FOR_TIME" }])).toThrow("repetidos");
    expect(parseBlocks(null)).toEqual([]);
    expect(readBlocks("lixo")).toEqual([]);
  });

  it("resumo de cada formato", () => {
    expect(blockSummary(parseBlock({ key: "a", kind: "CIRCUITO", rounds: 3, restSeconds: 60 }))).toBe("Circuito · 3 voltas · 60 s entre voltas");
    expect(blockSummary(parseBlock({ key: "a", kind: "AMRAP", windowSeconds: 600, name: "WOD" }))).toBe("WOD · AMRAP 10 min");
    expect(blockSummary(parseBlock({ key: "a", kind: "EMOM", intervals: 12, intervalSeconds: 90 }))).toBe("EMOM 12 × 1 min 30 s");
    expect(blockSummary(parseBlock({ key: "a", kind: "EMOM", name: "EMOM", intervals: 10, intervalSeconds: 60 }))).toBe("EMOM 10 × 1 min");
    expect(blockSummary(parseBlock({ key: "a", kind: "FOR_TIME", rounds: 3, timeCapSeconds: 900 }))).toBe("For Time · 3 rounds · limite 15 min");
  });

  it("agrupa: séries soltas primeiro, depois os blocos na ordem; chave órfã vira série solta", () => {
    const blocks = parseBlocks([{ key: "b2", kind: "AMRAP", windowSeconds: 600 }, { key: "b1", kind: "CIRCUITO", rounds: 3 }]);
    const items = [{ id: 1, blockKey: "b1" }, { id: 2, blockKey: null }, { id: 3, blockKey: "b2" }, { id: 4, blockKey: "sumiu" }];
    expect(groupByBlock(items, blocks).map((group) => [group.block?.key ?? null, group.items.map((item) => item.id)])).toEqual([
      [null, [2, 4]],
      ["b2", [3]],
      ["b1", [1]],
    ]);
  });
});

describe("timer e resultado do bloco", () => {
  it("tempo corrido desconta pausas e para no fim", async () => {
    const { blockElapsedSeconds } = await import("./workoutBlocks");
    const start = new Date("2026-10-11T10:00:00Z");
    expect(blockElapsedSeconds({ startedAt: null, pausedAt: null, pausedSeconds: 0, endedAt: null }, start)).toBe(0);
    expect(blockElapsedSeconds({ startedAt: start, pausedAt: null, pausedSeconds: 30, endedAt: null }, new Date("2026-10-11T10:05:00Z"))).toBe(270);
    expect(blockElapsedSeconds({ startedAt: start, pausedAt: new Date("2026-10-11T10:02:00Z"), pausedSeconds: 0, endedAt: null }, new Date("2026-10-11T10:09:00Z"))).toBe(120);
    expect(blockElapsedSeconds({ startedAt: start, pausedAt: null, pausedSeconds: 0, endedAt: new Date("2026-10-11T10:08:00Z") }, new Date("2026-10-11T11:00:00Z"))).toBe(480);
  });

  it("resumo do resultado por formato; limite atingido nunca vira tempo", async () => {
    const { blockResultSummary } = await import("./workoutBlocks");
    const empty = { outcome: null, roundsCompleted: null, partialReps: null, intervalsCompleted: null, elapsedSeconds: null };
    expect(blockResultSummary(parseBlock({ key: "a", kind: "AMRAP", windowSeconds: 600 }), { ...empty, roundsCompleted: 5, partialReps: 8 })).toBe("5 voltas + 8 reps");
    expect(blockResultSummary(parseBlock({ key: "a", kind: "CIRCUITO", rounds: 3 }), { ...empty, roundsCompleted: 2 })).toBe("2 de 3 voltas");
    expect(blockResultSummary(parseBlock({ key: "a", kind: "EMOM", intervals: 14 }), { ...empty, intervalsCompleted: 12 })).toBe("12 de 14 intervalos");
    const forTime = parseBlock({ key: "a", kind: "FOR_TIME", rounds: 3, timeCapSeconds: 900 });
    expect(blockResultSummary(forTime, { ...empty, outcome: "CONCLUIDO", elapsedSeconds: 582 })).toBe("Concluído em 9:42");
    expect(blockResultSummary(forTime, { ...empty, outcome: "LIMITE_ATINGIDO", roundsCompleted: 2, partialReps: 10 })).toBe("Limite atingido · 2 rounds + 10 reps");
  });
});
