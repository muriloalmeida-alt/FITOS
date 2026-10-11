import { authErrorResponse, requirePersonal } from "@/modules/tenancy/authContext";
import { StudentChargeError, generateChargeForRecurrenceMonth, generateNextChargeForRecurrence } from "@/modules/student-finance/charges";
import { parseReferenceMonth } from "@/shared/lib/referenceMonth";

/// Gera o próximo lançamento independente da recorrência (FIT-052) — ação
/// explícita do personal, nunca automática (sem infraestrutura de
/// agendamento nesta MVP). Com `{ referenceMonth: "AAAA-MM" }` (FIT-148),
/// lança a competência pedida — idempotente se já existir.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requirePersonal();
    const { id } = await params;
    const body = await request.json().catch(() => null);

    if (body && typeof body === "object" && "referenceMonth" in body) {
      const referenceMonth = parseReferenceMonth(body.referenceMonth);
      if (!referenceMonth) {
        return Response.json({ error: "VALIDACAO", message: "Competência inválida." }, { status: 400 });
      }
      const result = await generateChargeForRecurrenceMonth({ tenantId: ctx.tenantId, recurrenceId: id, referenceMonth });
      return Response.json(result.charge, { status: result.created ? 201 : 200 });
    }

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
