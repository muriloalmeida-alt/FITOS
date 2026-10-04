import { authErrorResponse, requirePersonal } from "@/modules/tenancy/authContext";
import { StudentChargeError, generateMonthChargesForRecurrences } from "@/modules/student-finance/charges";
import { parseReferenceMonth } from "@/shared/lib/referenceMonth";

/// BK-09 (FIT-148): "Gerar todas" — lança as mensalidades da competência
/// (`{ referenceMonth: "AAAA-MM" }`) para todas as recorrências ativas.
export async function POST(request: Request) {
  try {
    const ctx = await requirePersonal();
    const body = await request.json().catch(() => null);
    const referenceMonth = parseReferenceMonth(body?.referenceMonth);
    if (!referenceMonth) {
      return Response.json({ error: "VALIDACAO", message: "Competência inválida." }, { status: 400 });
    }
    const result = await generateMonthChargesForRecurrences({ tenantId: ctx.tenantId, referenceMonth });
    return Response.json(result, { status: 201 });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    if (error instanceof StudentChargeError) {
      return Response.json({ error: error.kind, message: error.message }, { status: 400 });
    }
    throw error;
  }
}
