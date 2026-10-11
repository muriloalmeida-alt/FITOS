import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";

/// Treino retroativo (feature 2, parte 2): trilha da versão anterior de um
/// treino editado ou excluído. Guarda data, duração, exercícios, séries e
/// os pontos de antes; sobrevive à exclusão (sem chave para a sessão).

export type RevisionAction = "EDITADO" | "EXCLUIDO";

type Client = PrismaClient | Prisma.TransactionClient;

export interface SessionSnapshot {
  mode: string;
  performedAt: string;
  declaredDurationSeconds: number | null;
  exercises: { exerciseId: string; name: string; sets: { reps: number | null; loadGrams: number | null; durationSeconds: number | null }[] }[];
  evidences: number;
}

export async function sessionSnapshot(client: Client, session: { id: string; tenantId: string; workoutId: string; mode: string; performedAt: Date | null; startedAt: Date; declaredDurationSeconds: number | null }): Promise<SessionSnapshot> {
  const [items, sets, evidences] = await Promise.all([
    client.workoutExercise.findMany({ where: { workoutId: session.workoutId, tenantId: session.tenantId }, orderBy: { position: "asc" }, select: { id: true, exerciseId: true, exercise: { select: { name: true } } } }),
    client.workoutSetResult.findMany({ where: { workoutSessionId: session.id, tenantId: session.tenantId }, orderBy: { setNumber: "asc" }, select: { workoutExerciseId: true, reps: true, loadGrams: true, durationSeconds: true } }),
    client.workoutEvidencePhoto.count({ where: { sessionId: session.id } }),
  ]);
  return {
    mode: session.mode,
    performedAt: (session.performedAt ?? session.startedAt).toISOString(),
    declaredDurationSeconds: session.declaredDurationSeconds,
    exercises: items.map((item) => ({
      exerciseId: item.exerciseId,
      name: item.exercise.name,
      sets: sets.filter((set) => set.workoutExerciseId === item.id).map(({ reps, loadGrams, durationSeconds }) => ({ reps, loadGrams, durationSeconds })),
    })),
    evidences,
  };
}

export async function recordRevision(
  client: Client,
  input: { tenantId: string; studentId: string; sessionId: string; actorUserId: string; action: RevisionAction; snapshot: SessionSnapshot; score: { totalTenths: number; status: string } | null }
) {
  return client.workoutSessionRevision.create({
    data: {
      tenantId: input.tenantId,
      studentId: input.studentId,
      sessionId: input.sessionId,
      actorUserId: input.actorUserId,
      action: input.action,
      snapshot: input.snapshot as unknown as Prisma.InputJsonValue,
      pointsTenthsBefore: input.score?.totalTenths ?? null,
      pointsStatusBefore: input.score?.status ?? null,
    },
  });
}
