import { CouponRuleError, formatCents, priceWithCoupons, type CouponKind } from "./coupons";

/// Desconto em vigor na assinatura, para mostrar com clareza na tela
/// "Sua assinatura": quanto, de onde veio e o valor da próxima cobrança.
/// Pura (recebe os resgates em vigor já filtrados).

export interface ActiveCoupon {
  code: string;
  kind: CouponKind;
  amount: number;
  stackable: boolean;
  durationCycles: number;
  cyclesUsed: number;
}

export interface SubscriptionDiscount {
  headline: string;
  origin: string;
  finalCents: number;
  finalLabel: string;
  baseLabel: string;
}

function origin(code: string): string {
  if (code.startsWith("AMIGO-")) return `Presente de quem te convidou (cupom ${code}).`;
  if (code.startsWith("CONHECA-")) return `Convite FitOS (cupom ${code}).`;
  if (code.startsWith("INDICA-")) return `Sua indicação foi confirmada (cupom ${code}).`;
  return `Cupom ${code}.`;
}

function valueLabel(coupon: ActiveCoupon): string {
  return coupon.kind === "PERCENT" ? `${(coupon.amount / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%` : formatCents(coupon.amount);
}

export function subscriptionDiscount(baseCents: number, coupons: ActiveCoupon[], cycle: "MENSAL" | "ANUAL" = "MENSAL"): SubscriptionDiscount | null {
  const active = coupons.filter((coupon) => coupon.cyclesUsed < coupon.durationCycles);
  if (active.length === 0 || baseCents <= 0) return null;
  let finalCents: number;
  try {
    finalCents = priceWithCoupons(baseCents, active).finalCents;
  } catch (error) {
    if (error instanceof CouponRuleError) return null;
    throw error;
  }
  const main = active[0]!;
  const left = main.durationCycles - main.cyclesUsed;
  const charge = cycle === "ANUAL" ? ["anuidade", "anuidades"] : ["mensalidade", "mensalidades"];
  const when = left === 1 ? `na próxima ${charge[0]}` : `nas próximas ${left} ${charge[1]}`;
  const value = active.map(valueLabel).join(" + ");
  return {
    headline: `${value} de desconto ${when}`,
    origin: `${active.map((coupon) => origin(coupon.code)).join(" ")} Depois, ${formatCents(baseCents)} por ${cycle === "ANUAL" ? "ano" : "mês"}.`,
    finalCents,
    finalLabel: formatCents(finalCents),
    baseLabel: formatCents(baseCents),
  };
}
