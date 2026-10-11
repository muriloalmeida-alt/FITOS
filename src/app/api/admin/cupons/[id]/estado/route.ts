import { requireAdmin } from "@/modules/tenancy/authContext";
import { setCouponStatus } from "@/modules/billing/coupons";
import { adminErrorResponse } from "../../../_errors";
import { couponsOff } from "../../_guard";

/// Ativar, pausar, retomar, encerrar ou arquivar (`action`).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const off = couponsOff();
  if (off) return off;
  try {
    const ctx = await requireAdmin();
    const body = (await request.json().catch(() => null)) as { action?: unknown } | null;
    return Response.json(await setCouponStatus(ctx.userId, (await params).id, body?.action));
  } catch (error) {
    return adminErrorResponse(error);
  }
}
