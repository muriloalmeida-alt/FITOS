import { describe, expect, it } from "vitest";
import { formatBrazilianPhone, isValidBrazilianPhone } from "./brazilianPhone";

describe("formatBrazilianPhone", () => {
  it("aplica a máscara progressivamente conforme os dígitos são digitados", () => {
    expect(formatBrazilianPhone("1")).toBe("(1");
    expect(formatBrazilianPhone("11")).toBe("(11");
    expect(formatBrazilianPhone("119")).toBe("(11) 9");
    expect(formatBrazilianPhone("11912345")).toBe("(11) 91234-5");
    expect(formatBrazilianPhone("11912345678")).toBe("(11) 91234-5678");
  });

  it("ignora caracteres não numéricos e trunca em 11 dígitos", () => {
    expect(formatBrazilianPhone("(11) 91234-5678extra")).toBe("(11) 91234-5678");
  });

  it("string vazia retorna vazia", () => {
    expect(formatBrazilianPhone("")).toBe("");
  });
});

describe("isValidBrazilianPhone", () => {
  it("válido com 11 dígitos (DDD + 9 + 8 dígitos)", () => {
    expect(isValidBrazilianPhone("(11) 91234-5678")).toBe(true);
  });

  it("inválido com menos de 11 dígitos (ex.: telefone fixo)", () => {
    expect(isValidBrazilianPhone("(11) 1234-5678")).toBe(false);
  });

  it("inválido vazio", () => {
    expect(isValidBrazilianPhone("")).toBe(false);
  });
});
