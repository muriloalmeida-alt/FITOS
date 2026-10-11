import { describe, expect, it } from "vitest";
import {
  CouponRuleError,
  audienceMatches,
  couponDiscountCents,
  couponSummary,
  formatCents,
  lifecycleSegments,
  normalizeCouponCode,
  parseCouponConfig,
  priceWithCoupons,
  stackingConflict,
  withinWindow,
  type AccountFacts,
} from "./coupons";

const now = new Date("2026-10-11T15:00:00Z");
const facts = (overrides: Partial<AccountFacts> = {}): AccountFacts => ({ tenantType: "PERSONAL", subscriptionStatus: "ATIVA", hasPaidCharge: false, paidAccessUntil: null, selected: false, ...overrides });

describe("código", () => {
  it("normaliza (trim, maiúsculas) e valida A–Z, 0–9 e hífen, 3 a 32", () => {
    expect(normalizeCouponCode("  black-friday ")).toBe("BLACK-FRIDAY");
    expect(normalizeCouponCode("ab")).toBeNull();
    expect(normalizeCouponCode("com espaço")).toBeNull();
    expect(normalizeCouponCode("x".repeat(33))).toBeNull();
    expect(normalizeCouponCode(42)).toBeNull();
  });
});

describe("preço (exemplos do PDF)", () => {
  it("percentual com half-up uma única vez; fixo limitado à base", () => {
    expect(couponDiscountCents(10_000, { kind: "PERCENT", amount: 2000 })).toBe(2000);
    expect(couponDiscountCents(10_000, { kind: "FIXED_AMOUNT", amount: 2500 })).toBe(2500);
    expect(couponDiscountCents(1990, { kind: "FIXED_AMOUNT", amount: 2500 })).toBe(1990);
    expect(couponDiscountCents(9990, { kind: "PERCENT", amount: 1500 })).toBe(1499);
    expect(priceWithCoupons(9990, [{ kind: "PERCENT", amount: 1500, stackable: false }]).finalCents).toBe(8491);
    expect(couponDiscountCents(0, { kind: "PERCENT", amount: 2000 })).toBe(0);
  });

  it("dois acumuláveis: fixo primeiro, depois percentual sobre o restante; nunca abaixo de zero", () => {
    const result = priceWithCoupons(10_000, [
      { kind: "PERCENT", amount: 1000, stackable: true },
      { kind: "FIXED_AMOUNT", amount: 2000, stackable: true },
    ]);
    // 100 − 20 = 80; 10% de 80 = 8; final 72.
    expect(result).toMatchObject({ discountCents: 2800, finalCents: 7200, discounts: [{ index: 1, cents: 2000 }, { index: 0, cents: 800 }] });
    expect(priceWithCoupons(1500, [{ kind: "FIXED_AMOUNT", amount: 1000, stackable: true }, { kind: "FIXED_AMOUNT", amount: 1000, stackable: true }]).finalCents).toBe(0);
  });

  it("acumulação: só entre dois acumuláveis, no máximo dois", () => {
    expect(stackingConflict([{ stackable: false }])).toBeNull();
    expect(stackingConflict([{ stackable: true }, { stackable: false }])).toMatch(/não pode ser usado junto/);
    expect(stackingConflict([{ stackable: true }, { stackable: true }, { stackable: true }])).toMatch(/No máximo dois/);
    expect(() => priceWithCoupons(100, [{ kind: "PERCENT", amount: 100, stackable: false }, { kind: "PERCENT", amount: 100, stackable: false }])).toThrow(CouponRuleError);
  });
});

describe("público", () => {
  it("segmentos de ciclo de vida", () => {
    expect(lifecycleSegments(facts({ subscriptionStatus: null }), now)).toEqual(["NOVOS"]);
    expect(lifecycleSegments(facts(), now)).toEqual(["NOVOS"]);
    expect(lifecycleSegments(facts({ hasPaidCharge: true }), now)).toEqual(["ATIVOS"]);
    expect(lifecycleSegments(facts({ subscriptionStatus: "CANCELADA", hasPaidCharge: true }), now)).toEqual(["INATIVOS"]);
    // Cancelada com período pago vigente não é inativa.
    expect(lifecycleSegments(facts({ subscriptionStatus: "CANCELADA", hasPaidCharge: true, paidAccessUntil: new Date("2026-10-20T00:00:00Z") }), now)).toEqual([]);
    // Inadimplência não é inatividade.
    expect(lifecycleSegments(facts({ subscriptionStatus: "INADIMPLENTE", hasPaidCharge: true }), now)).toEqual([]);
  });

  it("produto E segmento; selecionados exige a lista", () => {
    expect(audienceMatches({ products: ["PERSONAL"], segments: ["NOVOS", "INATIVOS"] }, facts(), now)).toBe(true);
    expect(audienceMatches({ products: ["INDIVIDUAL"], segments: ["NOVOS"] }, facts(), now)).toBe(false);
    expect(audienceMatches({ products: ["PERSONAL"], segments: ["ATIVOS"] }, facts(), now)).toBe(false);
    expect(audienceMatches({ products: ["PERSONAL"], segments: ["SELECIONADOS"] }, facts(), now)).toBe(false);
    expect(audienceMatches({ products: ["PERSONAL"], segments: ["SELECIONADOS"] }, facts({ selected: true }), now)).toBe(true);
  });

  it("janela de resgate com fim exclusivo", () => {
    const window = { startsAt: new Date("2026-10-01T03:00:00Z"), endsAt: new Date("2026-10-11T15:00:00Z") };
    expect(withinWindow(window, new Date("2026-10-11T14:59:59Z"))).toBe(true);
    expect(withinWindow(window, now)).toBe(false);
    expect(withinWindow({ startsAt: null, endsAt: null }, now)).toBe(true);
  });
});

describe("configuração", () => {
  const base = {
    code: "volta20",
    name: "Reativação outubro",
    kind: "PERCENT",
    amount: 2000,
    products: ["PERSONAL"],
    segments: ["INATIVOS"],
    planIds: ["p1"],
    cycles: ["MENSAL"],
    startsAt: "2026-10-01T03:00:00Z",
    endsAt: "2026-11-01T03:00:00Z",
    durationCycles: 3,
    maxRedemptions: 100,
    perAccountLimit: null,
    budgetCents: null,
    stackable: false,
    note: "",
  };

  it("valida e normaliza", () => {
    expect(parseCouponConfig(base)).toMatchObject({ code: "VOLTA20", amount: 2000, perAccountLimit: 1, stackable: false, note: null, maxRedemptions: 100 });
  });

  it("recusa percentual acima de 100%, duração fora da lista, selecionados misturado e janela invertida", () => {
    expect(() => parseCouponConfig({ ...base, amount: 10_001 })).toThrow(/Percentual/);
    expect(() => parseCouponConfig({ ...base, durationCycles: 4 })).toThrow(/Duração/);
    expect(() => parseCouponConfig({ ...base, segments: ["SELECIONADOS", "NOVOS"] })).toThrow(/selecionadas/);
    expect(() => parseCouponConfig({ ...base, endsAt: "2026-09-01T00:00:00Z" })).toThrow(/fim do resgate/);
    expect(() => parseCouponConfig({ ...base, planIds: [] })).toThrow(/plano/);
    expect(() => parseCouponConfig({ ...base, code: "x" })).toThrow(/Código/);
  });

  it("texto para o cliente", () => {
    expect(couponSummary({ kind: "PERCENT", amount: 2000, durationCycles: 3 })).toBe("20% de desconto por 3 ciclos. Depois, preço vigente do plano.");
    expect(couponSummary({ kind: "FIXED_AMOUNT", amount: 2500, durationCycles: 1 })).toMatch(/^R\$\s25,00 de desconto por 1 ciclo\./);
    expect(formatCents(8491)).toMatch(/84,91/);
  });
});
