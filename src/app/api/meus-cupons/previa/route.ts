import { requireSubscriber } from "@/modules/tenancy/authContext";
import { quoteCoupon } from "@/modules/billing/couponRedemptions";
import { couponErrorResponse, couponsOff } from "../_errors";

/// "Tem um cupom?": valida o código para a própria conta e mostra o preço.
/// Não consome nada.
export async function POST(request: Request) {
  const off = couponsOff();
  if (off) return off;
  try {
    const ctx = await requireSubscriber();
    const body = (await request.json().catch(() => null)) as { code?: unknown } | null;
    return Response.json(await quoteCoupon({ tenantId: ctx.tenantId }, body?.code));
  } catch (error) {
    return couponErrorResponse(error);
  }
}
