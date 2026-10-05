import { describe, expect, it } from "vitest";
import { nextChargeDate } from "./nextCharge";

const plan = { priceCents: 4990, billingCycle: "MENSAL" as const };
const base = { status: "ATIVA", createdAt: new Date("2026-08-15T12:00:00Z"), trialEndsAt: new Date("2026-09-14T12:00:00Z"), plan };

describe("nextChargeDate (EPIC-34)", () => {
  it("no teste: o fim do teste; depois: o aniversário mensal a partir dele", () => {
    expect(nextChargeDate(base, new Date("2026-09-01T00:00:00Z"))).toEqual(new Date("2026-09-14T12:00:00Z"));
    expect(nextChargeDate(base, new Date("2026-10-05T03:00:00Z"))).toEqual(new Date("2026-10-14T12:00:00Z"));
  });

  it("o próprio dia do vencimento conta (referência no começo do dia)", () => {
    expect(nextChargeDate(base, new Date("2026-10-14T03:00:00Z"))).toEqual(new Date("2026-10-14T12:00:00Z"));
  });

  it("anual pula 12 meses; sem teste conta da contratação", () => {
    expect(nextChargeDate({ ...base, trialEndsAt: null, plan: { ...plan, billingCycle: "ANUAL" } }, new Date("2026-10-01T00:00:00Z"))).toEqual(new Date("2027-08-15T12:00:00Z"));
  });

  it("plano gratuito ou cancelada: nada", () => {
    expect(nextChargeDate({ ...base, plan: { ...plan, priceCents: 0 } }, new Date())).toBeNull();
    expect(nextChargeDate({ ...base, status: "CANCELADA" }, new Date())).toBeNull();
  });
});
