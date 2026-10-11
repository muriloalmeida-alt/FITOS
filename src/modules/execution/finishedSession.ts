import "server-only";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { isCardioType } from "@/shared/lib/cardio";
import { retroEditable } from "./retroactive";

/// Um treino já realizado, para a própria pessoa (feature 2, parte 2):
/// resumo, séries, fotos e o que ainda dá para fazer (anexar foto, editar
/// o registro dentro do prazo, excluir).

export interface FinishedSessionDetail {
  id: string;
  workoutName: string;
  mode: "LIVE" | "RETROATIVO";
  performedAt: Date;
  recordedAt: Date;
  durationSeconds: number | null;
  exercises: { exerciseId: string; name: string; type: string | null; cardio: boolean; sets: { reps: number | null; loadKg: number | null; durationSeconds: number | null }[] }[];
  evidenceIds: string[];
  editable: boolean;
}

export async function getFinishedSessionForSelf(scope: { tenantId: string; studentId: string }, sessionId: string, client: PrismaClient = prisma, now = new Date()): Promise<FinishedSessionDetail | null> {
  const session = await client.workoutSession.findFirst({
    where: { id: sessionId, tenantId: scope.tenantId, studentId: scope.studentId, status: "CONCLUIDA" },
    include: {
      workout: { select: { name: true, workoutExercises: { orderBy: { position: "asc" }, select: { id: true, exerciseId: true, exercise: { select: { name: true, type: true } } } } } },
      setResults: { orderBy: { setNumber: "asc" }, select: { workoutExerciseId: true, reps: true, loadGrams: true, durationSeconds: true } },
      evidences: { orderBy: { createdAt: "asc" }, select: { id: true } },
    },
  });
  if (!session) return null;
  const elapsed = session.endedAt ? Math.round((session.endedAt.getTime() - session.startedAt.getTime()) / 1000) : null;
  return {
    id: session.id,
    workoutName: session.workout.name,
    mode: session.mode,
    performedAt: session.performedAt ?? session.startedAt,
    recordedAt: session.recordedAt,
    durationSeconds: session.declaredDurationSeconds ?? session.activeSeconds ?? elapsed,
    exercises: session.workout.workoutExercises
      .map((item) => ({
        exerciseId: item.exerciseId,
        name: item.exercise.name,
        type: item.exercise.type,
        cardio: isCardioType(item.exercise.type),
        sets: session.setResults.filter((set) => set.workoutExerciseId === item.id).map((set) => ({ reps: set.reps, loadKg: set.loadGrams === null ? null : set.loadGrams / 1000, durationSeconds: set.durationSeconds })),
      }))
      .filter((item) => item.sets.length > 0),
    evidenceIds: session.evidences.map((evidence) => evidence.id),
    editable: retroEditable(session, now),
  };
}
