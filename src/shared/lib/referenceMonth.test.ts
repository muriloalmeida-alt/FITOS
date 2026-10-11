import { describe, expect, it } from "vitest";
import { parseReferenceMonth, referenceMonthKey, referenceMonthLabel, shiftReferenceMonth } from "./referenceMonth";

describe("referenceMonth", () => {
  it("lê AAAA-MM e rejeita o resto", () => {
    expect(parseReferenceMonth("2026-10")?.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(parseReferenceMonth("2026-10-01")?.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(parseReferenceMonth("2026-13")).toBeNull();
    expect(parseReferenceMonth(202610)).toBeNull();
  });

  it("troca de mês atravessando o ano e formata", () => {
    const jan = shiftReferenceMonth(new Date(Date.UTC(2026, 11, 1)), 1);
    expect(referenceMonthKey(jan)).toBe("2027-01");
    expect(referenceMonthLabel(jan)).toBe("Janeiro de 2027");
  });
});
