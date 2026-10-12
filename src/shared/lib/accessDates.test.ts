import { describe, expect, it } from "vitest";
import { accessDateLabel, grantOutlastsTrial } from "./accessDates";

const now = new Date("2026-10-12T12:00:00Z");

describe("datas da gratuidade", () => {
  it("mostra o ano só fora do ano corrente", () => {
    expect(accessDateLabel(new Date("2026-11-05T12:00:00Z"), now)).toBe("5 de novembro");
    expect(accessDateLabel(new Date("2027-11-05T12:00:00Z"), now)).toBe("5 de novembro de 2027");
  });

  it("gratuidade que passa do teste grátis é a que vale para o cliente", () => {
    const trial = new Date("2026-11-05T03:00:00Z");
    expect(grantOutlastsTrial(trial, new Date("2027-11-05T03:00:00Z"), now)).toBe(true);
    expect(grantOutlastsTrial(trial, new Date("2026-11-01T03:00:00Z"), now)).toBe(false);
    expect(grantOutlastsTrial(null, new Date("2026-12-01T03:00:00Z"), now)).toBe(true);
    expect(grantOutlastsTrial(trial, null, now)).toBe(false);
    expect(grantOutlastsTrial(null, new Date("2026-10-01T03:00:00Z"), now)).toBe(false);
  });
});

describe("shortAccessDateLabel", () => {
  it("data curta para a faixa do Início caber numa linha", async () => {
    const { shortAccessDateLabel } = await import("./accessDates");
    expect(shortAccessDateLabel(new Date("2027-02-02T12:00:00-03:00"))).toBe("02/02/2027");
  });
});
