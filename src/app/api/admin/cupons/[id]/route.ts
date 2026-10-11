import { requireAdmin } from "@/modules/tenancy/authContext";
import { getCoupon, updateCoupon } from "@/modules/billing/coupons";
import { adminErrorResponse } from "../../_errors";
import { configFrom, couponsOff } from "../_guard";

/// Uma campanha: detalhe e edição (rascunho muda a versão; ativa cria outra).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const off = couponsOff();
  if (off) return off;
  try {
    await requireAdmin();
    return Response.json(await getCoupon((await params).id));
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const off = couponsOff();
  if (off) return off;
  try {
    const ctx = await requireAdmin();
    const body = ((await request.json().catch(() => null)) as Record<string, unknown> | null) ?? {};
    return Response.json(await updateCoupon(ctx.userId, (await params).id, configFrom(body)));
  } catch (error) {
    return adminErrorResponse(error);
  }
}
