import { describe, expect, it } from "vitest";
import { secretsMatch } from "./secretCompare";

describe("secretsMatch", () => {
  it("retorna true quando os valores são idênticos", () => {
    expect(secretsMatch("segredo-longo-123", "segredo-longo-123")).toBe(true);
  });

  it("retorna false quando os valores têm o mesmo tamanho mas diferem", () => {
    expect(secretsMatch("segredo-longo-123", "segredo-longo-124")).toBe(false);
  });

  it("retorna false quando os valores têm tamanhos diferentes, sem comparar byte a byte", () => {
    expect(secretsMatch("curto", "um-segredo-bem-mais-longo")).toBe(false);
  });

  it("retorna false para string vazia contra um segredo não vazio", () => {
    expect(secretsMatch("", "segredo")).toBe(false);
  });

  it("retorna true quando ambos são string vazia", () => {
    expect(secretsMatch("", "")).toBe(true);
  });
});
