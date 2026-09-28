import { describe, expect, it } from "vitest";
import { formatCpfCnpj, isValidCpfCnpj } from "./cpfCnpj";

describe("formatCpfCnpj", () => {
  it("aplica a máscara de CPF progressivamente até 11 dígitos", () => {
    expect(formatCpfCnpj("1")).toBe("1");
    expect(formatCpfCnpj("111")).toBe("111");
    expect(formatCpfCnpj("111444")).toBe("111.444");
    expect(formatCpfCnpj("111444777")).toBe("111.444.777");
    expect(formatCpfCnpj("11144477735")).toBe("111.444.777-35");
  });

  it("muda para a máscara de CNPJ a partir do 12º dígito", () => {
    expect(formatCpfCnpj("112223330001")).toBe("11.222.333/0001");
    expect(formatCpfCnpj("11222333000181")).toBe("11.222.333/0001-81");
  });

  it("ignora caracteres não numéricos e trunca em 14 dígitos", () => {
    expect(formatCpfCnpj("11.222.333/0001-81extra")).toBe("11.222.333/0001-81");
  });

  it("string vazia retorna vazia", () => {
    expect(formatCpfCnpj("")).toBe("");
  });
});

describe("isValidCpfCnpj", () => {
  it("CPF válido (dígito verificador real, exemplo de teste conhecido)", () => {
    expect(isValidCpfCnpj("111.444.777-35")).toBe(true);
    expect(isValidCpfCnpj("11144477735")).toBe(true);
  });

  it("CNPJ válido (dígito verificador real, exemplo de teste conhecido)", () => {
    expect(isValidCpfCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCpfCnpj("11222333000181")).toBe(true);
  });

  it("CPF com dígito verificador errado é inválido", () => {
    expect(isValidCpfCnpj("111.444.777-36")).toBe(false);
  });

  it("CNPJ com dígito verificador errado é inválido", () => {
    expect(isValidCpfCnpj("11.222.333/0001-82")).toBe(false);
  });

  it("sequência de dígitos iguais é sempre inválida, mesmo com 11 ou 14 dígitos", () => {
    expect(isValidCpfCnpj("00000000000")).toBe(false);
    expect(isValidCpfCnpj("11111111111")).toBe(false);
    expect(isValidCpfCnpj("00000000000000")).toBe(false);
  });

  it("tamanho diferente de 11 ou 14 dígitos é sempre inválido", () => {
    expect(isValidCpfCnpj("123")).toBe(false);
    expect(isValidCpfCnpj("123456789012")).toBe(false);
  });

  it("vazio é inválido", () => {
    expect(isValidCpfCnpj("")).toBe(false);
  });
});
