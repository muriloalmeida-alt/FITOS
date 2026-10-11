import { authErrorResponse, requirePersonal } from "@/modules/tenancy/authContext";
import { buildPersonalExport } from "@/modules/account/personalExport";
import { logEvent } from "@/shared/lib/serverLog";

/// Baixa os dados do espaço do personal (EPIC-37, LGPD): ZIP com planilhas.
export async function GET() {
  try {
    const ctx = await requirePersonal();
    const { filename, zip } = await buildPersonalExport({ tenantId: ctx.tenantId });
    logEvent("info", "account_data_exported", { userId: ctx.userId, tenantId: ctx.tenantId, bytes: zip.byteLength });
    return new Response(new Uint8Array(zip), {
      headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" },
    });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
