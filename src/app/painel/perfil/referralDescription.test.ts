import { describe, expect, it } from "vitest";
import { referralDescription } from "./LivreProfileView";

describe("referralDescription (indicação do FitOS Livre)", () => {
  it("explica a regra e mostra o andamento", () => {
    expect(referralDescription({ invited: 0, confirmed: 0, discountPending: false })).toMatch(/50% no primeiro mês.*10% na próxima mensalidade \(não acumula\)\.$/);
    expect(referralDescription({ invited: 3, confirmed: 1, discountPending: false })).toMatch(/Amigos: 3, 1 assinou\.$/);
    expect(referralDescription({ invited: 3, confirmed: 2, discountPending: true })).toMatch(/Você tem 10% garantidos na próxima mensalidade\.$/);
  });
});
