import "server-only";
import type { PrismaClient, WorkoutBlockResult } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { blockElapsedSeconds, readBlocks, type BlockOutcome, type WorkoutBlock } from "@/shared/lib/workoutBlocks";
import { SessionError } from "./sessions";

/// Funcional e CrossFit (feature 1, etapa 3): timer e resultado de cada
/// bloco no treino ao vivo. O servidor guarda os instantes (início, pausa,
/// fim) e as pausas acumuladas; a tela recalcula ao voltar. Ações
/// repetidas (reconexão, duplo toque) não duplicam nada.

type Scope = { tenantId: string; studentId: string };

async function sessionBlock(scope: Scope, sessionId: string, blockKey: string, client: PrismaClient): Promise<WorkoutBlock> {
  const session = await client.workoutSession.findFirst({ where: { id: sessionId, tenantId: scope.tenantId, studentId: scope.studentId }, select: { status: true, workout: { select: { blocks: true } } } });
  if (!session) throw new SessionError("NAO_ENCONTRADO", "Treino não encontrado.");
  if (session.status !== "EM_ANDAMENTO") throw new SessionError("ESTADO_INVALIDO", "O treino já foi encerrado.");
  const block = readBlocks(session.workout.blocks).find((entry) => entry.key === blockKey);
  if (!block) throw new SessionError("NAO_ENCONTRADO", "Bloco não encontrado neste treino.");
  return block;
}

export async function listBlockResults(scope: Scope, sessionId: string, client: PrismaClient = prisma): Promise<WorkoutBlockResult[]> {
  return client.workoutBlockResult.findMany({ where: { sessionId, tenantId: scope.tenantId, session: { studentId: scope.studentId } } });
}

export type TimerAction = "INICIAR" | "PAUSAR" | "RETOMAR";

/// Iniciar, pausar ou retomar o timer do bloco. Idempotente.
export async function blockTimer(scope: Scope, sessionId: string, blockKey: string, action: TimerAction, client: PrismaClient = prisma, now = new Date()): Promise<WorkoutBlockResult> {
  await sessionBlock(scope, sessionId, blockKey, client);
  const where = { sessionId_blockKey: { sessionId, blockKey } };
  const current = await client.workoutBlockResult.findUnique({ where });
  if (current?.endedAt) throw new SessionError("ESTADO_INVALIDO", "Este bloco já foi encerrado.");
  if (action === "INICIAR") {
    if (current?.startedAt) return current;
    return client.workoutBlockResult.upsert({ where, create: { tenantId: scope.tenantId, sessionId, blockKey, startedAt: now }, update: { startedAt: now } });
  }
  if (!current?.startedAt) throw new SessionError("ESTADO_INVALIDO", "Inicie o bloco primeiro.");
  if (action === "PAUSAR") {
    if (current.pausedAt) return current;
    return client.workoutBlockResult.update({ where, data: { pausedAt: now } });
  }
  if (!current.pausedAt) return current;
  const paused = Math.max(0, Math.floor((now.getTime() - current.pausedAt.getTime()) / 1000));
  return client.workoutBlockResult.update({ where, data: { pausedAt: null, pausedSeconds: current.pausedSeconds + paused } });
}

export interface BlockResultInput {
  outcome?: unknown;
  roundsCompleted?: unknown;
  partialReps?: unknown;
  intervalsCompleted?: unknown;
  note?: unknown;
}

function count(value: unknown, label: string, max: number): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > max) throw new SessionError("VALIDACAO", `${label} inválido.`);
  return value;
}

/// Encerra o bloco com o resultado confirmado pela pessoa. Em For Time,
/// "concluído" guarda o tempo do timer; "limite atingido" nunca vira tempo.
/// Reenviar corrige o resultado (o tempo do fim não muda).
export async function finishBlock(scope: Scope, sessionId: string, blockKey: string, input: BlockResultInput, client: PrismaClient = prisma, now = new Date()): Promise<WorkoutBlockResult> {
  const block = await sessionBlock(scope, sessionId, blockKey, client);
  const outcome = input.outcome ?? "PARCIAL";
  if (outcome !== "CONCLUIDO" && outcome !== "LIMITE_ATINGIDO" && outcome !== "PARCIAL") throw new SessionError("VALIDACAO", "Resultado inválido.");
  if (outcome === "LIMITE_ATINGIDO" && block.kind !== "FOR_TIME") throw new SessionError("VALIDACAO", "Limite de tempo é só do For Time.");
  const roundsCompleted = count(input.roundsCompleted, "Número de voltas", 500);
  const partialReps = count(input.partialReps, "Repetições da volta parcial", 1000);
  const intervalsCompleted = count(input.intervalsCompleted, "Intervalos", block.intervals ?? 120);
  const note = typeof input.note === "string" && input.note.trim() ? input.note.trim().slice(0, 300) : null;

  const where = { sessionId_blockKey: { sessionId, blockKey } };
  const current = await client.workoutBlockResult.findUnique({ where });
  const endedAt = current?.endedAt ?? now;
  // Encerrar em pausa: a pausa em andamento também sai do tempo.
  const openPause = current?.pausedAt && !current.endedAt ? Math.max(0, Math.floor((now.getTime() - current.pausedAt.getTime()) / 1000)) : 0;
  const timer = { startedAt: current?.startedAt ?? null, pausedAt: null, pausedSeconds: (current?.pausedSeconds ?? 0) + openPause, endedAt };
  const elapsed = blockElapsedSeconds(timer, now);
  const elapsedSeconds = block.kind === "FOR_TIME" && outcome === "CONCLUIDO" && elapsed > 0 ? elapsed : null;
  const data = { outcome: outcome as BlockOutcome, roundsCompleted, partialReps, intervalsCompleted, note, elapsedSeconds, endedAt, pausedAt: null, pausedSeconds: timer.pausedSeconds };
  return client.workoutBlockResult.upsert({ where, create: { tenantId: scope.tenantId, sessionId, blockKey, ...data }, update: data });
}

/// Resultado do bloco em JSON (datas ISO) para a tela e as rotas.
export function serializeBlockResult(result: WorkoutBlockResult) {
  return {
    blockKey: result.blockKey,
    startedAt: result.startedAt?.toISOString() ?? null,
    pausedAt: result.pausedAt?.toISOString() ?? null,
    pausedSeconds: result.pausedSeconds,
    endedAt: result.endedAt?.toISOString() ?? null,
    outcome: result.outcome,
    roundsCompleted: result.roundsCompleted,
    partialReps: result.partialReps,
    intervalsCompleted: result.intervalsCompleted,
    elapsedSeconds: result.elapsedSeconds,
    note: result.note,
  };
}
