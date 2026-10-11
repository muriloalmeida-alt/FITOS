import { requireAdmin } from "@/modules/tenancy/authContext";
import { createCoupon, listCoupons } from "@/modules/billing/coupons";
import { adminErrorResponse } from "../_errors";
import { configFrom, couponsOff } from "./_guard";

/// Campanhas de cupom (feature 5): listar e criar em rascunho.
export async function GET(request: Request) {
  const off = couponsOff();
  if (off) return off;
  try {
    await requireAdmin();
    const query = new URL(request.url).searchParams.get("q") ?? undefined;
    return Response.json({ coupons: await listCoupons({ query }) });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const off = couponsOff();
  if (off) return off;
  try {
    const ctx = await requireAdmin();
    const body = ((await request.json().catch(() => null)) as Record<string, unknown> | null) ?? {};
    return Response.json(await createCoupon(ctx.userId, configFrom(body)), { status: 201 });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
