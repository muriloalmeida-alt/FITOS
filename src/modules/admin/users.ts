import "server-only";
import type { Prisma, PrismaClient, UserRole } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "@/shared/db/prisma";
import { cancelAsaasSubscription } from "@/modules/billing/asaasClient";
import { describeError, logEvent } from "@/shared/lib/serverLog";

/// Administração da plataforma: listar todos os usuários, trocar a senha e
/// excluir o usuário com tudo o que é dele. Só chamado depois de
/// `requireAdmin()`; nenhuma função aqui confia em dado do cliente além do
/// id do usuário-alvo.

export class AdminError extends Error {
  constructor(
    public readonly kind: "NAO_ENCONTRADO" | "PROIBIDO" | "VALIDACAO",
    message: string
  ) {
    super(message);
    this.name = "AdminError";
  }
}

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: Date;
  /// Espaço do personal ou do FitOS Livre; para o aluno, o espaço do personal.
  spaceName: string | null;
  hasPassword: boolean;
}

export const ADMIN_PAGE_SIZE = 30;

export async function listUsersForAdmin(
  input: { query?: string; role?: UserRole | null; page?: number },
  client: PrismaClient = prisma
): Promise<{ users: AdminUserRow[]; total: number; page: number; pages: number }> {
  const query = input.query?.trim() ?? "";
  const where: Prisma.UserWhereInput = {
    ...(input.role ? { role: input.role } : {}),
    ...(query ? { OR: [{ email: { contains: query, mode: "insensitive" } }, { name: { contains: query, mode: "insensitive" } }] } : {}),
  };
  const total = await client.user.count({ where });
  const pages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const page = Math.min(Math.max(1, input.page ?? 1), pages);
  const users = await client.user.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: (page - 1) * ADMIN_PAGE_SIZE,
    take: ADMIN_PAGE_SIZE,
    include: {
      ownedTenant: { select: { name: true } },
      studentProfile: { select: { tenant: { select: { name: true } } } },
      accounts: { where: { providerId: "credential" }, select: { id: true } },
    },
  });
  return {
    users: users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      spaceName: user.ownedTenant?.name ?? user.studentProfile?.tenant.name ?? null,
      hasPassword: user.accounts.length > 0,
    })),
    total,
    page,
    pages,
  };
}

export interface AdminUserDetail extends AdminUserRow {
  /// O que a exclusão leva junto, para a confirmação mostrar antes.
  counts: { students: number; trainingPlans: number; workoutSessions: number; assessments: number; charges: number };
  subscription: { planName: string; status: string } | null;
  studentStatus: string | null;
}

export async function getUserForAdmin(userId: string, client: PrismaClient = prisma): Promise<AdminUserDetail> {
  const user = await client.user.findUnique({
    where: { id: userId },
    include: {
      ownedTenant: { include: { saasSubscription: { include: { plan: { select: { name: true } } } } } },
      studentProfile: { include: { tenant: { select: { name: true } } } },
      accounts: { where: { providerId: "credential" }, select: { id: true } },
    },
  });
  if (!user) throw new AdminError("NAO_ENCONTRADO", "Usuário não encontrado.");

  const tenantId = user.ownedTenant?.id ?? null;
  const studentId = user.studentProfile?.id ?? null;
  // Do espaço próprio (personal/Livre) ou do cadastro como aluno.
  const scope = [...(tenantId ? [{ tenantId }] : []), ...(studentId ? [{ studentId }] : [])];
  const none = Promise.resolve(0);
  const [students, trainingPlans, workoutSessions, assessments, charges] = await Promise.all([
    tenantId ? client.student.count({ where: { tenantId } }) : none,
    tenantId ? client.trainingPlan.count({ where: { tenantId, isSnapshot: false } }) : none,
    scope.length > 0 ? client.workoutSession.count({ where: { OR: scope } }) : none,
    scope.length > 0 ? client.assessment.count({ where: { OR: scope, deletedAt: null } }) : none,
    scope.length > 0 ? client.studentCharge.count({ where: { OR: scope } }) : none,
  ]);
  const subscription = user.ownedTenant?.saasSubscription ?? null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    spaceName: user.ownedTenant?.name ?? user.studentProfile?.tenant.name ?? null,
    hasPassword: user.accounts.length > 0,
    counts: { students, trainingPlans, workoutSessions, assessments, charges },
    subscription: subscription ? { planName: subscription.plan.name, status: subscription.status } : null,
    studentStatus: user.studentProfile?.status ?? null,
  };
}

/// Troca a senha de qualquer usuário (exceto outro administrador) e
/// encerra as sessões abertas dele. Cria a credencial se ainda não houver.
export async function setUserPasswordByAdmin(input: { adminUserId: string; userId: string; password: string }, client: PrismaClient = prisma): Promise<void> {
  if (input.password.length < 8 || input.password.length > 128) {
    throw new AdminError("VALIDACAO", "A senha precisa ter entre 8 e 128 caracteres.");
  }
  const user = await client.user.findUnique({ where: { id: input.userId }, select: { id: true, email: true, role: true } });
  if (!user) throw new AdminError("NAO_ENCONTRADO", "Usuário não encontrado.");
  if (user.role === "ADMIN" && user.id !== input.adminUserId) {
    throw new AdminError("PROIBIDO", "A senha de outro administrador não pode ser alterada aqui.");
  }

  const hash = await hashPassword(input.password);
  await client.$transaction(async (tx) => {
    const credential = await tx.account.findFirst({ where: { userId: user.id, providerId: "credential" } });
    if (credential) {
      await tx.account.update({ where: { id: credential.id }, data: { password: hash } });
    } else {
      await tx.account.create({ data: { userId: user.id, providerId: "credential", accountId: user.id, password: hash } });
    }
    if (user.id !== input.adminUserId) {
      await tx.session.deleteMany({ where: { userId: user.id } });
    }
  });
  logEvent("info", "admin_password_changed", { adminUserId: input.adminUserId, userId: user.id });
}

/// Exclui o usuário e tudo o que é dele, sem volta:
/// - personal ou FitOS Livre: o espaço inteiro (alunos do espaço, programas,
///   treinos, execuções, avaliações, cobranças, assinatura). A assinatura
///   no Asaas é cancelada antes. As contas dos alunos continuam existindo,
///   agora sem vínculo.
/// - aluno: o cadastro dele no espaço do personal, com execuções,
///   avaliações, metas e cobranças.
/// Nunca exclui um administrador nem a própria conta.
export async function deleteUserByAdmin(
  input: { adminUserId: string; userId: string },
  client: PrismaClient = prisma,
  deps: { apiKey?: string; fetchImpl?: typeof fetch } = {}
): Promise<{ email: string }> {
  if (input.userId === input.adminUserId) throw new AdminError("PROIBIDO", "Você não pode excluir a própria conta.");
  const user = await client.user.findUnique({
    where: { id: input.userId },
    include: { ownedTenant: { include: { saasSubscription: true } }, studentProfile: { select: { id: true } } },
  });
  if (!user) throw new AdminError("NAO_ENCONTRADO", "Usuário não encontrado.");
  if (user.role === "ADMIN") throw new AdminError("PROIBIDO", "Administradores não podem ser excluídos aqui.");

  const tenant = user.ownedTenant;
  const externalSubscriptionId = tenant?.saasSubscription?.status !== "CANCELADA" ? (tenant?.saasSubscription?.externalSubscriptionId ?? null) : null;
  if (externalSubscriptionId) {
    const apiKey = deps.apiKey ?? process.env.API_ASAAS;
    if (apiKey) {
      try {
        await cancelAsaasSubscription({ apiKey, fetchImpl: deps.fetchImpl }, externalSubscriptionId);
      } catch (error) {
        // Segue com a exclusão: o registro fica no log para cancelar à mão.
        logEvent("error", "admin_delete_asaas_cancel_failed", { userId: user.id, externalSubscriptionId, ...describeError(error) });
      }
    }
  }

  await client.$transaction(async (tx) => {
    const studentId = user.studentProfile?.id ?? null;
    if (studentId) {
      // Pagamento → cobrança e cobrança → recorrência são RESTRICT: saem
      // antes do aluno; o resto (execuções, avaliações, metas) em cascata.
      await tx.payment.deleteMany({ where: { studentCharge: { studentId } } });
      await tx.studentCharge.deleteMany({ where: { studentId } });
      await tx.student.delete({ where: { id: studentId } });
    }
    if (tenant) {
      // Ordem explícita: várias relações dentro do espaço são RESTRICT
      // (pagamento → cobrança, execução → treino, item → exercício…), então
      // uma cascata única a partir do espaço falharia.
      const where = { tenantId: tenant.id };
      await tx.payment.deleteMany({ where });
      await tx.workoutSetResult.deleteMany({ where });
      await tx.workoutSessionResult.deleteMany({ where });
      await tx.workoutSession.deleteMany({ where });
      await tx.planAssignment.deleteMany({ where });
      await tx.studentCharge.deleteMany({ where });
      await tx.chargeRecurrence.deleteMany({ where });
      await tx.workoutExercise.deleteMany({ where });
      await tx.workout.deleteMany({ where });
      await tx.trainingPlan.deleteMany({ where });
      await tx.exercise.deleteMany({ where });
      await tx.saasSubscription.deleteMany({ where });
      // O resto (alunos, avaliações, medidas, metas, convites, perfis,
      // auditoria) sai em cascata. As contas dos alunos ficam, sem vínculo.
      await tx.tenant.delete({ where: { id: tenant.id } });
    }
    // Referências restantes ao usuário em outros espaços (raras: só
    // histórico de auditoria ou de encerramento de vínculo).
    await tx.student.updateMany({ where: { endedByUserId: user.id }, data: { endedByUserId: null } });
    await tx.auditEvent.deleteMany({ where: { actorUserId: user.id } });
    await tx.payment.deleteMany({ where: { recordedByUserId: user.id } });
    await tx.assessment.deleteMany({ where: { authorUserId: user.id } });
    await tx.user.delete({ where: { id: user.id } });
  });

  logEvent("info", "admin_user_deleted", { adminUserId: input.adminUserId, userId: user.id, role: user.role, tenantId: tenant?.id ?? null });
  return { email: user.email };
}
