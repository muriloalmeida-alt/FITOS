import { authErrorResponse, requirePersonal } from "@/modules/tenancy/authContext";
import { AssessmentError, createAssessment } from "@/modules/evolution/assessments";

const VALID_MEASUREMENT_TYPES = ["CINTURA", "QUADRIL", "PEITO", "BRACO", "COXA", "PANTURRILHA"] as const;

function parseOptionalNumber(value: unknown): number | null | typeof NaN {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

/// Registra uma avaliação do aluno (FIT-042) — sempre autorada pelo
/// personal autenticado (`ctx.userId`), nunca pelo próprio aluno.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requirePersonal();
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return Response.json({ error: "VALIDACAO", message: "Corpo da requisição inválido." }, { status: 400 });
    }

    const weightKg = parseOptionalNumber(body.weightKg);
    const bodyFatPercent = parseOptionalNumber(body.bodyFatPercent);
    if (Number.isNaN(weightKg) || Number.isNaN(bodyFatPercent)) {
      return Response.json({ error: "VALIDACAO", message: "Valores numéricos inválidos." }, { status: 400 });
    }

    const measurementsInput = Array.isArray(body.measurements) ? body.measurements : [];
    const measurementsCm: { type: (typeof VALID_MEASUREMENT_TYPES)[number]; valueCm: number }[] = [];
    for (const entry of measurementsInput) {
      if (!entry || typeof entry !== "object" || !VALID_MEASUREMENT_TYPES.includes(entry.type)) {
        return Response.json({ error: "VALIDACAO", message: "Tipo de medida inválido." }, { status: 400 });
      }
      const valueCm = Number(entry.valueCm);
      if (!Number.isFinite(valueCm)) {
        return Response.json({ error: "VALIDACAO", message: "Valor de medida inválido." }, { status: 400 });
      }
      measurementsCm.push({ type: entry.type, valueCm });
    }

    const assessment = await createAssessment({
      tenantId: ctx.tenantId,
      actorUserId: ctx.userId,
      studentId: id,
      weightKg,
      bodyFatPercent,
      notes: typeof body.notes === "string" ? body.notes : null,
      measurementsCm,
    });
    return Response.json(assessment, { status: 201 });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    if (error instanceof AssessmentError) {
      const status = error.kind === "NAO_ENCONTRADO" ? 404 : 400;
      return Response.json({ error: error.kind, message: error.message }, { status });
    }
    throw error;
  }
}
