import { authErrorResponse, requirePersonal } from "@/modules/tenancy/authContext";
import { StudentChargeError, cancelStudentCharge } from "@/modules/student-finance/charges";

/// Cancela uma cobrança (FIT-050) — exige motivo, nunca equivale a
/// pagamento (`REGRAS-DE-NEGOCIO.md` seção 8).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requirePersonal();
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const reason = body && typeof body === "object" && typeof body.reason === "string" ? body.reason : "";

    const charge = await cancelStudentCharge({ tenantId: ctx.tenantId, chargeId: id, reason });
    return Response.json(charge);
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    if (error instanceof StudentChargeError) {
      const status = error.kind === "NAO_ENCONTRADO" ? 404 : error.kind === "ESTADO_INVALIDO" ? 409 : 400;
      return Response.json({ error: error.kind, message: error.message }, { status });
    }
    throw error;
  }
}
