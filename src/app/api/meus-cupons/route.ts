import { requireSubscriber } from "@/modules/tenancy/authContext";
import { listMyCoupons, redeemCoupon } from "@/modules/billing/couponRedemptions";
import { couponErrorResponse, couponsOff } from "./_errors";

/// Cupons da própria conta (personal ou Livre).
export async function GET() {
  const off = couponsOff();
  if (off) return off;
  try {
    const ctx = await requireSubscriber();
    return Response.json({ coupons: await listMyCoupons(ctx.tenantId) });
  } catch (error) {
    return couponErrorResponse(error);
  }
}

/// Confirma o resgate da prévia (`revision`); `operationKey` repetida
/// devolve o mesmo resgate.
export async function POST(request: Request) {
  const off = couponsOff();
  if (off) return off;
  try {
    const ctx = await requireSubscriber();
    const body = (await request.json().catch(() => null)) as { code?: unknown; operationKey?: unknown; revision?: unknown } | null;
    const result = await redeemCoupon({ tenantId: ctx.tenantId, actorUserId: ctx.userId, code: body?.code, operationKey: body?.operationKey, revision: body?.revision });
    return Response.json({ id: result.redemption.id, replayed: result.replayed }, { status: result.replayed ? 200 : 201 });
  } catch (error) {
    return couponErrorResponse(error);
  }
}
