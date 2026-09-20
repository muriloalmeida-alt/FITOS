import { authErrorResponse, requirePersonal } from "@/modules/tenancy/authContext";
import { StudentChargeError, generateNextChargeForRecurrence } from "@/modules/student-finance/charges";

/// Gera o próximo lançamento independente da recorrência (FIT-052) — ação
/// explícita do personal, nunca automática (sem infraestrutura de
/// agendamento nesta MVP).
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requirePersonal();
    const { id } = await params;

    const charge = await generateNextChargeForRecurrence({ tenantId: ctx.tenantId, recurrenceId: id });
    return Response.json(charge, { status: 201 });
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
