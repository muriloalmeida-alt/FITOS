import { describe, expect, it } from "vitest";
import {
  formatCreditCardNumber,
  formatPostalCode,
  isValidCreditCardCcv,
  isValidCreditCardExpiry,
  isValidCreditCardNumber,
  isValidPostalCode,
} from "./creditCard";

describe("formatCreditCardNumber", () => {
  it("agrupa em blocos de 4 enquanto digita", () => {
    expect(formatCreditCardNumber("4111111111111111")).toBe("4111 1111 1111 1111");
    expect(formatCreditCardNumber("411111")).toBe("4111 11");
  });

  it("ignora caracteres não numéricos e limita a 19 dígitos", () => {
    expect(formatCreditCardNumber("4111-1111-1111-1111-999")).toBe("4111 1111 1111 1111 999");
  });
});

describe("isValidCreditCardNumber", () => {
  it("aceita um número real válido pelo algoritmo de Luhn (cartão de teste Visa)", () => {
    expect(isValidCreditCardNumber("4111 1111 1111 1111")).toBe(true);
  });

  it("aceita um número real válido pelo algoritmo de Luhn (cartão de teste Mastercard)", () => {
    expect(isValidCreditCardNumber("5555 5555 5555 4444")).toBe(true);
  });

  it("rejeita um número que falha o checksum de Luhn", () => {
    expect(isValidCreditCardNumber("4111 1111 1111 1112")).toBe(false);
  });

  it("rejeita tamanho fora da faixa 13-19", () => {
    expect(isValidCreditCardNumber("411111")).toBe(false);
  });

  it("rejeita sequência de um único dígito repetido, mesmo que passasse o checksum", () => {
    expect(isValidCreditCardNumber("0000000000000000")).toBe(false);
  });
});

describe("isValidCreditCardCcv", () => {
  it("aceita 3 ou 4 dígitos", () => {
    expect(isValidCreditCardCcv("123")).toBe(true);
    expect(isValidCreditCardCcv("1234")).toBe(true);
  });

  it("rejeita qualquer outro tamanho", () => {
    expect(isValidCreditCardCcv("12")).toBe(false);
    expect(isValidCreditCardCcv("12345")).toBe(false);
    expect(isValidCreditCardCcv("")).toBe(false);
  });
});

describe("isValidCreditCardExpiry", () => {
  const reference = new Date("2026-09-28T00:00:00Z");

  it("aceita mês/ano no futuro", () => {
    expect(isValidCreditCardExpiry("10", "2026", reference)).toBe(true);
    expect(isValidCreditCardExpiry("01", "2027", reference)).toBe(true);
  });

  it("aceita o mês atual (ainda não venceu)", () => {
    expect(isValidCreditCardExpiry("09", "2026", reference)).toBe(true);
  });

  it("rejeita mês/ano no passado", () => {
    expect(isValidCreditCardExpiry("08", "2026", reference)).toBe(false);
    expect(isValidCreditCardExpiry("12", "2025", reference)).toBe(false);
  });

  it("rejeita mês fora de 1-12", () => {
    expect(isValidCreditCardExpiry("13", "2027", reference)).toBe(false);
    expect(isValidCreditCardExpiry("00", "2027", reference)).toBe(false);
  });

  it("rejeita ano com formato diferente de 4 dígitos", () => {
    expect(isValidCreditCardExpiry("10", "26", reference)).toBe(false);
  });
});

describe("formatPostalCode", () => {
  it("aplica a máscara 12345-678", () => {
    expect(formatPostalCode("01310100")).toBe("01310-100");
    expect(formatPostalCode("01310")).toBe("01310");
  });
});

describe("isValidPostalCode", () => {
  it("aceita exatamente 8 dígitos", () => {
    expect(isValidPostalCode("01310-100")).toBe(true);
  });

  it("rejeita qualquer outro tamanho", () => {
    expect(isValidPostalCode("01310")).toBe(false);
    expect(isValidPostalCode("")).toBe(false);
  });
});
