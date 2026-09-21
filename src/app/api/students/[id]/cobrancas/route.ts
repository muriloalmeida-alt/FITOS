import { authErrorResponse, requirePersonal } from "@/modules/tenancy/authContext";
import { StudentChargeError, createStudentCharge, listChargesForStudent } from "@/modules/student-finance/charges";

/// Cadastra uma cobrança do aluno (FIT-050) — sempre pelo personal
/// autenticado, nunca pelo próprio aluno.
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
    const referenceMonth = new Date(body.referenceMonth);
    const dueDate = new Date(body.dueDate);
    if (!Number.isFinite(amountReais)) {
      return Response.json({ error: "VALIDACAO", message: "Valor inválido." }, { status: 400 });
    }

    const charge = await createStudentCharge({
      tenantId: ctx.tenantId,
      studentId: id,
      description,
      amountReais,
      referenceMonth,
      dueDate,
    });
    return Response.json(charge, { status: 201 });
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

/// Histórico de cobranças do aluno — apenas o personal consulta nesta
/// Sprint (nenhuma História do backlog pede uma visão financeira para o
/// próprio aluno; implementá-la seria especulativo). Isolamento garantido
/// por `ctx.tenantId` do contexto de autorização, nunca aceito do cliente.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requirePersonal();
    const { id } = await params;
    const charges = await listChargesForStudent({ tenantId: ctx.tenantId, studentId: id });
    return Response.json(charges);
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
