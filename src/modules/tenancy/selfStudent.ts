import "server-only";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { AuthError, requireSession } from "./authContext";
import { ensureStudentForIndividual } from "./ensureStudentForIndividual";

/// "Eu" como aluno (EPIC-30): o aluno com vínculo ativo ou o praticante do
/// FitOS Livre (auto-referência). Pesar, escolher meta: as mesmas ações
/// para os dois, sempre sobre o próprio registro — nunca um `studentId`
/// vindo do cliente.
export async function requireSelfStudent(client: PrismaClient = prisma): Promise<{ userId: string; role: "ALUNO" | "INDIVIDUAL"; tenantId: string; studentId: string }> {
  const ctx = await requireSession(undefined, client);
  if (ctx.role === "ALUNO" && ctx.tenantId && ctx.studentId) {
    return { userId: ctx.userId, role: "ALUNO", tenantId: ctx.tenantId, studentId: ctx.studentId };
  }
  if (ctx.role === "INDIVIDUAL") {
    const student = await ensureStudentForIndividual({ id: ctx.tenantId, ownerId: ctx.userId }, client);
    return { userId: ctx.userId, role: "INDIVIDUAL", tenantId: ctx.tenantId, studentId: student.id };
  }
  throw new AuthError("FORBIDDEN", "Acesso restrito a quem treina.");
}
