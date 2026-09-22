import type { BodyMeasurementType } from "@prisma/client";
import { authErrorResponse, requireIndividual } from "@/modules/tenancy/authContext";
import { ensureStudentForIndividual } from "@/modules/tenancy/ensureStudentForIndividual";
import { AssessmentError, createAssessment, listAssessmentsForStudent } from "@/modules/evolution/assessments";

const VALID_MEASUREMENT_TYPES: BodyMeasurementType[] = ["CINTURA", "QUADRIL", "PEITO", "BRACO", "COXA", "PANTURRILHA"];

/// Autoavaliação do próprio praticante individual (FIT-104) — reaproveita
/// `createAssessment`/`listAssessmentsForStudent` (FIT-042) sem alteração,
/// só troca quem é o autor: aqui `actorUserId === ctx.userId`, a mesma
/// pessoa que está sendo avaliada. A regra "avaliação nunca é autorada
/// pelo próprio aluno" (ver `assessments.ts`) é sobre o caso com personal
/// — não existe personal aqui, então não há nada a proteger.
export async function GET() {
  try {
    const ctx = await requireIndividual();
    const student = await ensureStudentForIndividual({ id: ctx.tenantId, ownerId: ctx.userId });
    const assessments = await listAssessmentsForStudent({ tenantId: ctx.tenantId, studentId: student.id });
    return Response.json(assessments);
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

function isValidMeasurements(value: unknown): value is { type: BodyMeasurementType; valueCm: number }[] {
  if (!Array.isArray(value)) return false;
  return value.every(
    (m) =>
      m &&
      typeof m === "object" &&
      VALID_MEASUREMENT_TYPES.includes((m as { type?: unknown }).type as BodyMeasurementType) &&
      typeof (m as { valueCm?: unknown }).valueCm === "number"
  );
}

export async function POST(request: Request) {
  try {
    const ctx = await requireIndividual();
    const body = await request.json().catch(() => null);

    if (
      !body ||
      (body.weightKg !== null && typeof body.weightKg !== "number") ||
      (body.bodyFatPercent !== null && typeof body.bodyFatPercent !== "number") ||
      (body.notes !== null && typeof body.notes !== "string") ||
      !isValidMeasurements(body.measurementsCm ?? [])
    ) {
      return Response.json({ error: "VALIDACAO", message: "Dados de avaliação inválidos." }, { status: 400 });
    }

    const student = await ensureStudentForIndividual({ id: ctx.tenantId, ownerId: ctx.userId });
    const assessment = await createAssessment({
      tenantId: ctx.tenantId,
      actorUserId: ctx.userId,
      studentId: student.id,
      weightKg: body.weightKg ?? null,
      bodyFatPercent: body.bodyFatPercent ?? null,
      notes: body.notes ?? null,
      measurementsCm: body.measurementsCm ?? [],
    });
    return Response.json(assessment, { status: 201 });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    if (error instanceof AssessmentError) {
      return Response.json({ error: error.kind, message: error.message }, { status: 400 });
    }
    throw error;
  }
}
