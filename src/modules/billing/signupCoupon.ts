import "server-only";
import type { PrismaClient, TenantType } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { couponSummary, normalizeCouponCode, withinWindow } from "@/shared/lib/coupons";
import { CouponRedemptionError, quoteCoupon, redeemCoupon } from "./couponRedemptions";
import { describeError, logEvent } from "@/shared/lib/serverLog";

/// Cupom informado no cadastro: conferido antes de a conta existir (só o
/// que dá para saber sem ela: código ativo, produto e público de contas
/// novas) e resgatado logo depois que a assinatura é criada. Fica
/// registrado na conta e vale nas cobranças seguintes, como qualquer
/// cupom resgatado em "Assinatura".

export type SignupCouponCheck = { ok: true; code: string; summary: string } | { ok: false; message: string };

const INVALID = "Cupom não encontrado. Confira o código.";

export async function checkSignupCoupon(raw: unknown, product: TenantType, client: PrismaClient = prisma, now = new Date()): Promise<SignupCouponCheck> {
  const code = normalizeCouponCode(raw);
  if (!code) return { ok: false, message: INVALID };
  const coupon = await client.coupon.findUnique({ where: { code }, include: { currentVersion: true } });
  const version = coupon?.currentVersion;
  if (!coupon || !version || coupon.status === "DRAFT" || coupon.status === "ARCHIVED") return { ok: false, message: INVALID };
  if (coupon.status !== "ACTIVE" || !withinWindow(version, now)) return { ok: false, message: "Este cupom não está mais disponível." };
  // Cupons de contas escolhidas (convites, indicação) nunca valem para quem digita o código.
  if (!version.products.includes(product) || !version.segments.includes("NOVOS")) return { ok: false, message: product === "PERSONAL" ? "Este cupom não vale para contas de personal." : "Este cupom não vale para o FitOS Livre." };
  if (version.maxRedemptions !== null) {
    const taken = await client.couponRedemption.count({ where: { couponId: coupon.id, state: { in: ["COMMITTED", "ENDED"] } } });
    if (taken >= version.maxRedemptions) return { ok: false, message: "As vagas deste cupom acabaram." };
  }
  return { ok: true, code, summary: couponSummary(version) };
}

export type SignupCouponResult = { applied: true; code: string } | { applied: false; message: string };

/// Resgata o cupom do cadastro na conta nova (idempotente por conta).
/// Nunca derruba o cadastro: o motivo volta para a tela.
export async function redeemSignupCoupon(input: { tenantId: string; userId: string; code: unknown }, client: PrismaClient = prisma, now = new Date()): Promise<SignupCouponResult> {
  const code = normalizeCouponCode(input.code);
  if (!code) return { applied: false, message: INVALID };
  try {
    const quote = await quoteCoupon({ tenantId: input.tenantId }, code, client, now);
    await redeemCoupon({ tenantId: input.tenantId, actorUserId: input.userId, code, operationKey: `cadastro-${input.tenantId}`, revision: quote.revision }, client, now);
    logEvent("info", "cupom_cadastro_aplicado", { tenantId: input.tenantId, code });
    return { applied: true, code };
  } catch (error) {
    if (error instanceof CouponRedemptionError) {
      if (error.kind === "ALREADY_USED") return { applied: true, code };
      return { applied: false, message: error.kind === "CONFLICT" ? "Você já tem o desconto do convite; os cupons não se somam." : error.message };
    }
    logEvent("error", "cupom_cadastro_falhou", { tenantId: input.tenantId, ...describeError(error) });
    return { applied: false, message: "Não foi possível aplicar o cupom agora. Tente de novo em Assinatura." };
  }
}
