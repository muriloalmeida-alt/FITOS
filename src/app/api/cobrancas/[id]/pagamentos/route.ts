import { authErrorResponse, requirePersonal } from "@/modules/tenancy/authContext";
import { StudentChargeError, registerPayment } from "@/modules/student-finance/charges";

/// Registra o pagamento de uma cobrança (FIT-051) — sempre autorado pelo
/// personal autenticado (`ctx.userId`), nunca pelo próprio aluno.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requirePersonal();
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return Response.json({ error: "VALIDACAO", message: "Corpo da requisição inválido." }, { status: 400 });
    }

    const amountReceivedReais = Number(body.amountReceivedReais);
    const paidAt = new Date(body.paidAt);
    const method = typeof body.method === "string" ? body.method : "";
    if (!Number.isFinite(amountReceivedReais)) {
      return Response.json({ error: "VALIDACAO", message: "Valor inválido." }, { status: 400 });
    }

    const charge = await registerPayment({
      tenantId: ctx.tenantId,
      actorUserId: ctx.userId,
      chargeId: id,
      amountReceivedReais,
      paidAt,
      method,
    });
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
