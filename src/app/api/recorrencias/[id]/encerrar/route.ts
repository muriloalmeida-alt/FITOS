import { authErrorResponse, requirePersonal } from "@/modules/tenancy/authContext";
import { StudentChargeError, endChargeRecurrence } from "@/modules/student-finance/charges";

/// Encerra uma cobrança recorrente (FIT-052) — nunca uma exclusão física;
/// lançamentos já gerados nunca são afetados.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requirePersonal();
    const { id } = await params;

    const recurrence = await endChargeRecurrence({ tenantId: ctx.tenantId, recurrenceId: id });
    return Response.json(recurrence);
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    if (error instanceof StudentChargeError) {
      const status = error.kind === "NAO_ENCONTRADO" ? 404 : 400;
      return Response.json({ error: error.kind, message: error.message }, { status });
    }
    throw error;
  }
}
