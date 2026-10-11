import "server-only";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { isCardioType } from "@/shared/lib/cardio";
import { retroEditable } from "./retroactive";
import { readBlocks, type WorkoutBlock } from "@/shared/lib/workoutBlocks";
import { serializeBlockResult } from "./blockResults";

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
  /// Funcional e CrossFit: blocos que tiveram resultado registrado.
  blocks: { block: WorkoutBlock; result: ReturnType<typeof serializeBlockResult> }[];
  exercises: { exerciseId: string; name: string; type: string | null; cardio: boolean; blockKey: string | null; sets: { reps: number | null; loadKg: number | null; durationSeconds: number | null }[] }[];
  evidenceIds: string[];
  editable: boolean;
}

export async function getFinishedSessionForSelf(scope: { tenantId: string; studentId: string }, sessionId: string, client: PrismaClient = prisma, now = new Date()): Promise<FinishedSessionDetail | null> {
  const session = await client.workoutSession.findFirst({
    where: { id: sessionId, tenantId: scope.tenantId, studentId: scope.studentId, status: "CONCLUIDA" },
    include: {
      blockResults: true,
      workout: { select: { name: true, blocks: true, workoutExercises: { orderBy: { position: "asc" }, select: { id: true, exerciseId: true, blockKey: true, exercise: { select: { name: true, type: true } } } } } },
      setResults: { orderBy: { setNumber: "asc" }, select: { workoutExerciseId: true, reps: true, loadGrams: true, durationSeconds: true } },
      evidences: { orderBy: { createdAt: "asc" }, select: { id: true } },
    },
  });
  if (!session) return null;
  const blocks = readBlocks(session.workout.blocks).flatMap((block) => {
    const result = session.blockResults.find((entry) => entry.blockKey === block.key);
    return result ? [{ block, result: serializeBlockResult(result) }] : [];
  });
  const withResult = new Set(blocks.map((entry) => entry.block.key));
  const elapsed = session.endedAt ? Math.round((session.endedAt.getTime() - session.startedAt.getTime()) / 1000) : null;
  return {
    id: session.id,
    workoutName: session.workout.name,
    mode: session.mode,
    performedAt: session.performedAt ?? session.startedAt,
    recordedAt: session.recordedAt,
    durationSeconds: session.declaredDurationSeconds ?? session.activeSeconds ?? elapsed,
    blocks,
    exercises: session.workout.workoutExercises
      .map((item) => ({
        exerciseId: item.exerciseId,
        name: item.exercise.name,
        type: item.exercise.type,
        cardio: isCardioType(item.exercise.type),
        blockKey: item.blockKey && withResult.has(item.blockKey) ? item.blockKey : null,
        sets: session.setResults.filter((set) => set.workoutExerciseId === item.id).map((set) => ({ reps: set.reps, loadKg: set.loadGrams === null ? null : set.loadGrams / 1000, durationSeconds: set.durationSeconds })),
      }))
      // Exercício de bloco conta pelo resultado do bloco, mesmo sem séries.
      .filter((item) => item.sets.length > 0 || item.blockKey !== null),
    evidenceIds: session.evidences.map((evidence) => evidence.id),
    editable: retroEditable(session, now),
  };
}
