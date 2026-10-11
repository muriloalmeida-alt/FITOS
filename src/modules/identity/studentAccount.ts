import "server-only";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { hashInvitationToken } from "@/modules/students/invitations";

/// Saídas da tela "Sem vínculo" do aluno (FIT-151): entrar com o código
/// de convite de um personal (sem criar outra conta) ou passar a treinar
/// por conta própria no FitOS Livre. Vale para quem não tem vínculo ativo
/// — nunca tira um aluno ativo do personal atual.
///
/// `Student.userId` é único: o vínculo antigo (inativo ou encerrado) é
/// desligado da conta, mas continua no tenant do personal antigo com todo
/// o histórico (nunca apagado).

export class StudentAccountError extends Error {
  constructor(
    public readonly kind: "CODIGO_INVALIDO" | "JA_VINCULADO" | "PAPEL_INVALIDO",
    message: string
  ) {
    super(message);
    this.name = "StudentAccountError";
  }
}

/// Aceita o token puro ou o link inteiro do convite (`...?token=XYZ`).
export function invitationTokenFromCode(code: string): string {
  const trimmed = code.trim();
  const match = /[?&]token=([^&#\s]+)/.exec(trimmed);
  return match ? decodeURIComponent(match[1]!) : trimmed;
}

async function assertCanLeaveCurrentLink(userId: string, client: PrismaClient) {
  const user = await client.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== "ALUNO") {
    throw new StudentAccountError("PAPEL_INVALIDO", "Esta ação é só para contas de aluno.");
  }
  const current = await client.student.findUnique({ where: { userId } });
  if (current?.status === "ATIVO") {
    throw new StudentAccountError("JA_VINCULADO", "Você já treina com um personal.");
  }
  return current;
}

export async function joinPersonalWithInvitation(input: { userId: string; code: string }, client: PrismaClient = prisma): Promise<{ studentId: string; tenantId: string }> {
  const current = await assertCanLeaveCurrentLink(input.userId, client);
  const token = invitationTokenFromCode(input.code);
  const invalid = new StudentAccountError("CODIGO_INVALIDO", "Código inválido ou expirado. Peça um novo convite ao seu personal.");
  if (!token) throw invalid;

  const invitation = await client.invitation.findUnique({ where: { tokenHash: hashInvitationToken(token) }, include: { student: true } });
  if (!invitation || invitation.status !== "PENDENTE" || invitation.expiresAt < new Date() || invitation.student.userId || invitation.student.status !== "ATIVO") {
    throw invalid;
  }

  return client.$transaction(async (tx) => {
    const claim = await tx.invitation.updateMany({ where: { id: invitation.id, status: "PENDENTE" }, data: { status: "ACEITO", acceptedAt: new Date() } });
    if (claim.count !== 1) throw invalid;
    if (current) await tx.student.update({ where: { id: current.id }, data: { userId: null } });
    const link = await tx.student.updateMany({ where: { id: invitation.studentId, userId: null }, data: { userId: input.userId } });
    if (link.count !== 1) throw invalid;
    return { studentId: invitation.studentId, tenantId: invitation.tenantId };
  });
}

/// "Treinar por conta própria": a conta vira FitOS Livre. O espaço
/// individual é criado no próximo acesso (`ensureTenantForIndividual`) e o
/// app leva ao onboarding do Livre.
export async function switchToIndividual(input: { userId: string }, client: PrismaClient = prisma): Promise<void> {
  const current = await assertCanLeaveCurrentLink(input.userId, client);
  await client.$transaction(async (tx) => {
    if (current) await tx.student.update({ where: { id: current.id }, data: { userId: null } });
    await tx.user.update({ where: { id: input.userId }, data: { role: "INDIVIDUAL" } });
  });
}
