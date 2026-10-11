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
