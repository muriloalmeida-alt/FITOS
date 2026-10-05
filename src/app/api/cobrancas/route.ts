import { authErrorResponse, requirePersonal } from "@/modules/tenancy/authContext";
import { StudentChargeError, createChargeWithOptionalRecurrence } from "@/modules/student-finance/charges";
import { parseReferenceMonth } from "@/shared/lib/referenceMonth";

/// BK-10 (FIT-148): "Nova cobrança" do Financeiro — aluno, valor, dia de
/// vencimento, competência e, opcionalmente, "Repetir todo mês" (cria a
/// recorrência e o primeiro lançamento juntos).
export async function POST(request: Request) {
  try {
    const ctx = await requirePersonal();
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return Response.json({ error: "VALIDACAO", message: "Corpo da requisição inválido." }, { status: 400 });
    }
    const amountReais = Number(body.amountReais);
    const referenceMonth = parseReferenceMonth(body.referenceMonth);
    if (!Number.isFinite(amountReais) || !referenceMonth || typeof body.studentId !== "string") {
      return Response.json({ error: "VALIDACAO", message: "Confira aluno, valor e competência." }, { status: 400 });
    }
    const result = await createChargeWithOptionalRecurrence({
      tenantId: ctx.tenantId,
      studentId: body.studentId,
      description: typeof body.description === "string" ? body.description : "",
      amountReais,
      referenceMonth,
      dueDayOfMonth: Number(body.dueDayOfMonth),
      repeatMonthly: body.repeatMonthly === true,
    });
    return Response.json(result, { status: 201 });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    if (error instanceof StudentChargeError) {
      return Response.json({ error: error.kind, message: error.message }, { status: error.kind === "NAO_ENCONTRADO" ? 404 : 400 });
    }
    throw error;
  }
}
