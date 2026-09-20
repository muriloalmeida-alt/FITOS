import { authErrorResponse, requirePersonal } from "@/modules/tenancy/authContext";
import { StudentChargeError, createChargeRecurrence } from "@/modules/student-finance/charges";

/// Cria uma cobrança recorrente para o aluno (FIT-052) — ainda não gera
/// nenhum lançamento; a geração é uma ação separada.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requirePersonal();
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return Response.json({ error: "VALIDACAO", message: "Corpo da requisição inválido." }, { status: 400 });
    }

    const description = typeof body.description === "string" ? body.description : "";
    const amountReais = Number(body.amountReais);
    const dueDayOfMonth = Number(body.dueDayOfMonth);
    if (!Number.isFinite(amountReais) || !Number.isFinite(dueDayOfMonth)) {
      return Response.json({ error: "VALIDACAO", message: "Valor ou dia de vencimento inválido." }, { status: 400 });
    }

    const recurrence = await createChargeRecurrence({
      tenantId: ctx.tenantId,
      studentId: id,
      description,
      amountReais,
      dueDayOfMonth,
    });
    return Response.json(recurrence, { status: 201 });
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
