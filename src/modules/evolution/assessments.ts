import "server-only";
import { type Assessment, type BodyMeasurement, type BodyMeasurementType, type PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { getStudentForTenant } from "@/modules/students/students";

/// Avaliação e evolução do aluno (FIT-042). Peso e medidas corporais são
/// sempre positivos ("Peso e medidas não podem aceitar valores negativos",
/// `REGRAS-DE-NEGOCIO.md`, seção 7) — nenhuma função deste módulo aceita
/// zero ou negativo. Uma avaliação, uma vez criada, nunca é editada — só
/// excluída logicamente (`softDeleteAssessment`), mesma filosofia de
/// "preserva histórico" de toda esta base. Fotografias de evolução
/// (opcionais, exigem autorização explícita do aluno — mesma seção) estão
/// fora do escopo desta História: nenhuma Issue pediu a feature, e
/// implementar o fluxo de autorização sem um pedido de produto para ela
/// seria especulativo.

export class AssessmentError extends Error {
  constructor(
    public readonly kind: "VALIDACAO" | "NAO_ENCONTRADO",
    message: string
  ) {
    super(message);
    this.name = "AssessmentError";
  }
}

const MAX_NOTES_LENGTH = 500;
const MAX_BODY_FAT_TENTH_PERCENT = 999;

function gramsFromKg(weightKg: number | null): number | null {
  if (weightKg === null) {
    return null;
  }
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    throw new AssessmentError("VALIDACAO", "O peso deve ser maior que zero.");
  }
  return Math.round(weightKg * 1000);
}

function tenthPercentFromPercent(bodyFatPercent: number | null): number | null {
  if (bodyFatPercent === null) {
    return null;
  }
  if (!Number.isFinite(bodyFatPercent) || bodyFatPercent <= 0) {
    throw new AssessmentError("VALIDACAO", "O percentual de gordura deve ser maior que zero.");
  }
  const tenthPercent = Math.round(bodyFatPercent * 10);
  if (tenthPercent > MAX_BODY_FAT_TENTH_PERCENT) {
    throw new AssessmentError("VALIDACAO", "O percentual de gordura informado não é válido.");
  }
  return tenthPercent;
}

function millimetersFromCm(valueCm: number): number {
  if (!Number.isFinite(valueCm) || valueCm <= 0) {
    throw new AssessmentError("VALIDACAO", "Cada medida corporal deve ser maior que zero.");
  }
  return Math.round(valueCm * 10);
}

function normalizeNotes(notes: string | null): string | null {
  if (notes === null) {
    return null;
  }
  const trimmed = notes.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > MAX_NOTES_LENGTH) {
    throw new AssessmentError("VALIDACAO", `A observação deve ter no máximo ${MAX_NOTES_LENGTH} caracteres.`);
  }
  return trimmed;
}

export interface CreateAssessmentInput {
  tenantId: string;
  actorUserId: string;
  studentId: string;
  weightKg: number | null;
  bodyFatPercent: number | null;
  notes: string | null;
  measurementsCm: { type: BodyMeasurementType; valueCm: number }[];
}

export type AssessmentWithMeasurements = Assessment & { measurements: BodyMeasurement[] };

/// Registra uma avaliação do aluno — sempre autorada pelo personal
/// autenticado (`actorUserId`), nunca pelo próprio aluno. `studentId`
/// precisa pertencer ao tenant da sessão (`NAO_ENCONTRADO` caso
/// contrário, mesmo padrão de isolamento do restante da aplicação).
export async function createAssessment(
  input: CreateAssessmentInput,
  client: PrismaClient = prisma
): Promise<AssessmentWithMeasurements> {
  const student = await getStudentForTenant({ tenantId: input.tenantId, studentId: input.studentId }, client);
  if (!student) {
    throw new AssessmentError("NAO_ENCONTRADO", "Aluno não encontrado.");
  }

  const weightGrams = gramsFromKg(input.weightKg);
  const bodyFatTenthPercent = tenthPercentFromPercent(input.bodyFatPercent);
  const notes = normalizeNotes(input.notes);
  const measurements = input.measurementsCm.map((m) => ({ type: m.type, valueMillimeters: millimetersFromCm(m.valueCm) }));

  return client.$transaction(async (tx) => {
    const assessment = await tx.assessment.create({
      data: {
        tenantId: input.tenantId,
        studentId: input.studentId,
        authorUserId: input.actorUserId,
        weightGrams,
        bodyFatTenthPercent,
        notes,
      },
    });

    for (const measurement of measurements) {
      await tx.bodyMeasurement.create({
        data: {
          tenantId: input.tenantId,
          assessmentId: assessment.id,
          type: measurement.type,
          valueMillimeters: measurement.valueMillimeters,
        },
      });
    }

    return tx.assessment.findUniqueOrThrow({ where: { id: assessment.id }, include: { measurements: true } });
  });
}

/// Histórico cronológico (mais recente primeiro) do aluno — exclui
/// avaliações logicamente excluídas. Usado tanto pelo personal (ficha do
/// aluno) quanto pelo próprio aluno (a própria evolução, nunca a de
/// outro).
export async function listAssessmentsForStudent(
  input: { tenantId: string; studentId: string },
  client: PrismaClient = prisma
): Promise<AssessmentWithMeasurements[]> {
  return client.assessment.findMany({
    where: { tenantId: input.tenantId, studentId: input.studentId, deletedAt: null },
    orderBy: { recordedAt: "desc" },
    include: { measurements: true },
  });
}

/// Exclusão lógica de uma avaliação (`REGRAS-DE-NEGOCIO.md`, seção 7:
/// "Exclusões de avaliações devem ser lógicas e auditáveis") — nunca
/// remove a linha, marca `deletedAt`/`deletedByUserId` e registra
/// `AuditEvent` (seção 9 lista "avaliação" explicitamente). Idempotente:
/// excluir de novo uma já excluída é um no-op silencioso.
export async function softDeleteAssessment(
  input: { tenantId: string; actorUserId: string; assessmentId: string },
  client: PrismaClient = prisma
): Promise<Assessment> {
  const current = await client.assessment.findFirst({
    where: { id: input.assessmentId, tenantId: input.tenantId },
  });
  if (!current) {
    throw new AssessmentError("NAO_ENCONTRADO", "Avaliação não encontrada.");
  }
  if (current.deletedAt) {
    return current;
  }

  return client.$transaction(async (tx) => {
    const deleted = await tx.assessment.update({
      where: { id: input.assessmentId },
      data: { deletedAt: new Date(), deletedByUserId: input.actorUserId },
    });

    await tx.auditEvent.create({
      data: {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        action: "AVALIACAO_EXCLUIDA",
        entityType: "Assessment",
        entityId: deleted.id,
      },
    });

    return deleted;
  });
}
