import { describe, expect, it } from "vitest";
import { MODALITIES, modalitiesLabel, modalityDivergence, offerable, parseModalities, storedModalities } from "./modalities";

/// As sete combinações não vazias das três modalidades.
const COMBINATIONS = [1, 2, 3, 4, 5, 6, 7].map((mask) => MODALITIES.filter((_, index) => mask & (1 << index)));

describe("modalidades", () => {
  it("aceita as sete combinações não vazias, em ordem canônica e sem duplicatas", () => {
    for (const combination of COMBINATIONS) expect(parseModalities([...combination].reverse())).toEqual(combination);
    expect(parseModalities(["crossfit", "musculacao", "crossfit"])).toEqual(["musculacao", "crossfit"]);
  });

  it("recusa vazio, desconhecido e formato errado", () => {
    expect(() => parseModalities([])).toThrow(/uma ou mais/);
    expect(() => parseModalities(["musculacao", "pilates"])).toThrow(/desconhecida/);
    expect(() => parseModalities("musculacao,funcional")).toThrow(/uma ou mais/);
    expect(() => parseModalities(null)).toThrow();
  });

  it("rótulos e leitura tolerante", () => {
    expect(modalitiesLabel(["funcional", "musculacao"])).toBe("Musculação + Funcional");
    expect(modalitiesLabel([])).toBe("Não definidas");
    expect(storedModalities(["x", "crossfit"])).toEqual(["crossfit"]);
  });

  it("oferta: todas as modalidades do conteúdo entre as escolhidas; sem classificação não entra", () => {
    expect(offerable(["funcional"], ["musculacao", "funcional"])).toBe(true);
    expect(offerable(["crossfit"], ["musculacao", "funcional"])).toBe(false);
    expect(offerable(["musculacao", "funcional"], ["funcional"])).toBe(false);
    expect(offerable(["musculacao", "funcional"], ["musculacao", "funcional", "crossfit"])).toBe(true);
    expect(offerable([], ["musculacao"])).toBe(false);
    expect(offerable(["pilates"], ["musculacao"])).toBe(false);
  });

  it("divergência só com preferência e programa classificados", () => {
    expect(modalityDivergence(["musculacao"], ["funcional"])).toEqual(["musculacao"]);
    expect(modalityDivergence(["funcional"], ["funcional", "crossfit"])).toEqual([]);
    expect(modalityDivergence(["musculacao"], [])).toEqual([]);
    expect(modalityDivergence([], ["funcional"])).toEqual([]);
  });
});
