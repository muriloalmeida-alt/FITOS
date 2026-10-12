import { describe, expect, it } from "vitest";
import { subscriptionDiscount } from "./subscriptionDiscount";

const friend = { code: "AMIGO-ABC123", kind: "PERCENT" as const, amount: 5000, stackable: false, durationCycles: 1, cyclesUsed: 0 };

describe("subscriptionDiscount", () => {
  it("cupom de amigo: 50% na próxima mensalidade, de onde veio e o preço depois", () => {
    const discount = subscriptionDiscount(1990, [friend])!;
    expect(discount.headline).toBe("50% de desconto na próxima mensalidade");
    expect(discount.origin).toMatch(/^Presente de quem te convidou \(cupom AMIGO-ABC123\)\. Depois, R\$\s19,90 por mês\.$/);
    expect(discount.finalCents).toBe(995);
    expect(discount.finalLabel).toMatch(/R\$\s9,95/);
  });

  it("várias cobranças, cupom já usado e sem cupom", () => {
    expect(subscriptionDiscount(1990, [{ ...friend, code: "PROMO", durationCycles: 3, cyclesUsed: 1 }])!.headline).toBe("50% de desconto nas próximas 2 mensalidades");
    expect(subscriptionDiscount(1990, [{ ...friend, cyclesUsed: 1 }])).toBeNull();
    expect(subscriptionDiscount(1990, [])).toBeNull();
    expect(subscriptionDiscount(0, [friend])).toBeNull();
  });
});
