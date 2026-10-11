import { requirePersonal } from "@/modules/tenancy/authContext";
import { updateChargeRecurrence } from "@/modules/student-finance/charges";
import { chargeErrorResponse } from "../../_chargeErrors";

function optionalNumber(value: unknown): number | undefined | null {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/// Ajusta valor e/ou dia da mensalidade (EPIC-29, edição no perfil).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requirePersonal();
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return Response.json({ error: "VALIDACAO", message: "Corpo da requisição inválido." }, { status: 400 });
    }
    const amountReais = optionalNumber(body.amountReais);
    const dueDayOfMonth = optionalNumber(body.dueDayOfMonth);
    if (amountReais === null || dueDayOfMonth === null) {
      return Response.json({ error: "VALIDACAO", message: "Valor ou dia de vencimento inválido." }, { status: 400 });
    }
    const recurrence = await updateChargeRecurrence({ tenantId: ctx.tenantId, recurrenceId: id, amountReais, dueDayOfMonth });
    return Response.json(recurrence);
  } catch (error) {
    return chargeErrorResponse(error);
  }
}
