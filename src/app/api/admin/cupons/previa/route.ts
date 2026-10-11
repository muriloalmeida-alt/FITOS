import { requireAdmin } from "@/modules/tenancy/authContext";
import { previewCouponInput } from "@/modules/billing/coupons";
import { adminErrorResponse } from "../../_errors";
import { configFrom, couponsOff } from "../_guard";

/// Prévia da campanha: preço de cada plano e público estimado. Só calcula.
export async function POST(request: Request) {
  const off = couponsOff();
  if (off) return off;
  try {
    await requireAdmin();
    const body = ((await request.json().catch(() => null)) as Record<string, unknown> | null) ?? {};
    return Response.json(await previewCouponInput(configFrom(body)));
  } catch (error) {
    return adminErrorResponse(error);
  }
}
