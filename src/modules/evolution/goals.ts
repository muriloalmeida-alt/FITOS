import "server-only";
import { type Goal, type PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";

/// Metas pessoais de evolução (FIT-104). Ao contrário de `Assessment`
/// (sempre autorada por outra pessoa, o personal), toda meta é criada,
/// concluída ou abandonada pelo próprio dono (`studentId`) — nenhuma
/// função aqui recebe um `actorUserId` distinto. Uma meta concluída ou
/// abandonada nunca reabre; criar uma nova meta é o caminho, mesma
/// filosofia de "preserva histórico" do restante da base.

export class GoalError extends Error {
  constructor(
    public readonly kind: "VALIDACAO" | "NAO_ENCONTRADO" | "ESTADO_INVALIDO",
    message: string
  ) {
    super(message);
    this.name = "GoalError";
  }
}

const MAX_DESCRIPTION_LENGTH = 200;

function normalizeDescription(description: string): string {
  const trimmed = description.trim();
  if (trimmed.length === 0) {
    throw new GoalError("VALIDACAO", "A meta precisa de uma descrição.");
  }
  if (trimmed.length > MAX_DESCRIPTION_LENGTH) {
    throw new GoalError("VALIDACAO", `A descrição da meta deve ter no máximo ${MAX_DESCRIPTION_LENGTH} caracteres.`);
  }
  return trimmed;
}

export interface CreateGoalInput {
  tenantId: string;
  studentId: string;
  description: string;
  targetDate: Date | null;
}

export async function createGoal(input: CreateGoalInput, client: PrismaClient = prisma): Promise<Goal> {
  const description = normalizeDescription(input.description);
  return client.goal.create({
    data: { tenantId: input.tenantId, studentId: input.studentId, description, targetDate: input.targetDate },
  });
}

/// Mais recente primeiro — mesma convenção de `listAssessmentsForStudent`.
export async function listGoalsForStudent(
  input: { tenantId: string; studentId: string },
  client: PrismaClient = prisma
): Promise<Goal[]> {
  return client.goal.findMany({
    where: { tenantId: input.tenantId, studentId: input.studentId },
    orderBy: { createdAt: "desc" },
  });
}

async function getOwnGoalInProgressOrThrow(
  input: { tenantId: string; studentId: string; goalId: string },
  client: PrismaClient
): Promise<Goal> {
  const goal = await client.goal.findFirst({
    where: { id: input.goalId, tenantId: input.tenantId, studentId: input.studentId },
  });
  if (!goal) {
    throw new GoalError("NAO_ENCONTRADO", "Meta não encontrada.");
  }
  if (goal.status !== "EM_ANDAMENTO") {
    throw new GoalError("ESTADO_INVALIDO", "Esta meta já foi concluída ou abandonada.");
  }
  return goal;
}

export async function completeGoal(
  input: { tenantId: string; studentId: string; goalId: string },
  client: PrismaClient = prisma
): Promise<Goal> {
  const goal = await getOwnGoalInProgressOrThrow(input, client);
  return client.goal.update({ where: { id: goal.id }, data: { status: "CONCLUIDA", completedAt: new Date() } });
}

export async function abandonGoal(
  input: { tenantId: string; studentId: string; goalId: string },
  client: PrismaClient = prisma
): Promise<Goal> {
  const goal = await getOwnGoalInProgressOrThrow(input, client);
  return client.goal.update({ where: { id: goal.id }, data: { status: "ABANDONADA" } });
}
