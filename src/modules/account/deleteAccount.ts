import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import { verifyPassword } from "better-auth/crypto";
import { prisma } from "@/shared/db/prisma";
import { cancelAsaasSubscription } from "@/modules/billing/asaasClient";
import { describeError, logEvent } from "@/shared/lib/serverLog";
import { disconnectPaymentAccount } from "@/modules/student-finance/paymentAccount";

/// Exclusão de conta (EPIC-26 pelo admin; EPIC-37 pela própria pessoa, em
/// Configurações). Apaga o usuário e tudo o que é dele, sem volta:
/// - personal ou FitOS Livre: o espaço inteiro (alunos do espaço, programas,
///   treinos, execuções, avaliações, fotos, cobranças, assinatura). A
///   assinatura no Asaas é cancelada antes. As contas dos alunos continuam
///   existindo, agora sem vínculo.
/// - aluno: o cadastro dele no espaço do personal, com execuções,
///   avaliações, metas e cobranças.

type Deps = { apiKey?: string; fetchImpl?: typeof fetch };
type AccountToErase = Prisma.UserGetPayload<{ include: { ownedTenant: { include: { saasSubscription: true } }; studentProfile: { select: { id: true } } } }>;

export async function eraseAccount(user: AccountToErase, client: PrismaClient = prisma, deps: Deps = {}): Promise<{ tenantId: string | null }> {
  const tenant = user.ownedTenant;
  const externalSubscriptionId = tenant?.saasSubscription?.status !== "CANCELADA" ? (tenant?.saasSubscription?.externalSubscriptionId ?? null) : null;
  if (externalSubscriptionId) {
    const apiKey = deps.apiKey ?? process.env.API_ASAAS;
    if (apiKey) {
      try {
        await cancelAsaasSubscription({ apiKey, fetchImpl: deps.fetchImpl }, externalSubscriptionId);
      } catch (error) {
        // Segue com a exclusão: o registro fica no log para cancelar à mão.
        logEvent("error", "account_delete_asaas_cancel_failed", { userId: user.id, externalSubscriptionId, ...describeError(error) });
      }
    }
  }

  // A conta Asaas do personal (cobrança dos alunos, EPIC-38) sai antes:
  // o aviso de pagamento cadastrado nela é removido. Melhor esforço.
  if (tenant) await disconnectPaymentAccount({ tenantId: tenant.id }, client, { fetchImpl: deps.fetchImpl }).catch(() => undefined);

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
    await tx.evolutionPhoto.deleteMany({ where: { uploadedById: user.id } });
    await tx.user.delete({ where: { id: user.id } });
  });

  return { tenantId: tenant?.id ?? null };
}

export class DeleteOwnAccountError extends Error {
  constructor(
    public readonly kind: "SENHA_INCORRETA" | "CONFIRMACAO" | "PROIBIDO",
    message: string
  ) {
    super(message);
    this.name = "DeleteOwnAccountError";
  }
}

export const DELETE_CONFIRMATION = "EXCLUIR";

/// A própria pessoa exclui a conta. Com senha, confirma com a senha; sem
/// senha (só digital/Face ID), digitando EXCLUIR. Administrador não sai
/// por aqui.
export async function deleteOwnAccount(input: { userId: string; password?: string; confirmation?: string }, client: PrismaClient = prisma, deps: Deps = {}): Promise<{ email: string }> {
  const user = await client.user.findUniqueOrThrow({
    where: { id: input.userId },
    include: { ownedTenant: { include: { saasSubscription: true } }, studentProfile: { select: { id: true } } },
  });
  if (user.role === "ADMIN") throw new DeleteOwnAccountError("PROIBIDO", "A conta de administrador não pode ser excluída por aqui.");
  const account = await client.account.findFirst({ where: { userId: user.id, providerId: "credential", password: { not: null } } });
  if (account?.password) {
    if (!input.password || !(await verifyPassword({ hash: account.password, password: input.password }))) throw new DeleteOwnAccountError("SENHA_INCORRETA", "Senha incorreta.");
  } else if ((input.confirmation ?? "").trim().toUpperCase() !== DELETE_CONFIRMATION) {
    throw new DeleteOwnAccountError("CONFIRMACAO", `Digite ${DELETE_CONFIRMATION} para confirmar.`);
  }
  const { tenantId } = await eraseAccount(user, client, deps);
  logEvent("info", "account_deleted_by_owner", { userId: user.id, role: user.role, tenantId });
  return { email: user.email };
}
