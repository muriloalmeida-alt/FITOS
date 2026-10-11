import type { TenantType } from "@prisma/client";
import { requireAdmin } from "@/modules/tenancy/authContext";
import { searchCouponAccounts } from "@/modules/billing/coupons";
import { adminErrorResponse } from "../../_errors";
import { couponsOff } from "../_guard";

/// Busca de contas (personal e Livre) para o público "Selecionados".
export async function GET(request: Request) {
  const off = couponsOff();
  if (off) return off;
  try {
    await requireAdmin();
    const params = new URL(request.url).searchParams;
    const products = (params.get("produtos") ?? "PERSONAL,INDIVIDUAL").split(",").filter((value): value is TenantType => value === "PERSONAL" || value === "INDIVIDUAL");
    return Response.json({ accounts: await searchCouponAccounts(params.get("q") ?? "", products) });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
