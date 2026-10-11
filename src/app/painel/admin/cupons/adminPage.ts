import { notFound, redirect } from "next/navigation";
import { featureEnabled } from "@/shared/config/features";
import { AuthError, requireAdmin } from "@/modules/tenancy/authContext";

/// Páginas de cupons: só ADMIN e só com `FEATURE_CUPONS=on`.
export async function couponAdminPage(): Promise<{ userId: string }> {
  if (!featureEnabled("CUPONS")) notFound();
  try {
    return await requireAdmin();
  } catch (error) {
    if (error instanceof AuthError) redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    throw error;
  }
}
