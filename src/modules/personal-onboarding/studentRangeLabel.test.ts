import { describe, expect, it } from "vitest";
import { studentRangeLabel } from "./studentRangeLabel";

describe("studentRangeLabel", () => {
  it("retorna o rótulo real de cada valor do enum", () => {
    expect(studentRangeLabel("COMECANDO_AGORA")).toBe("Começando agora");
    expect(studentRangeLabel("ATE_20")).toBe("Até 20 alunos");
    expect(studentRangeLabel("DE_21_A_50")).toBe("De 21 a 50 alunos");
    expect(studentRangeLabel("MAIS_DE_50")).toBe("Mais de 50 alunos");
  });

  it("retorna um traço para valor vazio (estado inicial de formulário), nunca um rótulo fabricado", () => {
    expect(studentRangeLabel("")).toBe("—");
  });
});
