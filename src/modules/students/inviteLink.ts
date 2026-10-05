import "server-only";
import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { activateStudentAccount } from "@/modules/identity/activation";
import { createStudent } from "./students";
import { generateInvitation } from "./invitations";
import { applyLibraryItem } from "@/modules/library/library";
import { createChargeRecurrence } from "@/modules/student-finance/charges";
import { describeError, logEvent } from "@/shared/lib/serverLog";

/// Link de convite do personal (EPIC-29): um código fixo por espaço
/// (`/c/<código>`). Quem abre o link cria a própria conta de aluno, com o
/// nome e o e-mail dele; o personal não digita nada. Reaproveita as regras
/// de sempre: cadastro do aluno (limite do plano, e-mail único) e ativação
/// por convite (cria a conta, faz login, desfaz tudo se algo falhar).

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

function newCode(): string {
  const bytes = randomBytes(8);
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

export async function getOrCreateInviteCode(tenantId: string, client: PrismaClient = prisma): Promise<string> {
  const tenant = await client.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { inviteCode: true } });
  if (tenant.inviteCode) return tenant.inviteCode;
  return regenerateInviteCode(tenantId, client);
}

/// Gera um código novo; o antigo deixa de funcionar na hora.
export async function regenerateInviteCode(tenantId: string, client: PrismaClient = prisma): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = newCode();
    try {
      await client.tenant.update({ where: { id: tenantId }, data: { inviteCode: code } });
      return code;
    } catch {
      // Colisão improvável no índice único: tenta outro código.
    }
  }
  throw new Error("Não foi possível gerar o link de convite.");
}

export interface InviteLinkInfo {
  tenantId: string;
  businessName: string;
  personalName: string;
  cref: string | null;
}

export async function getInviteLink(code: string, client: PrismaClient = prisma): Promise<InviteLinkInfo | null> {
  if (!/^[a-z0-9]{6,16}$/.test(code)) return null;
  const tenant = await client.tenant.findUnique({ where: { inviteCode: code }, select: { id: true, name: true, type: true, owner: { select: { name: true } }, personalProfile: { select: { cref: true } } } });
  if (!tenant || tenant.type !== "PERSONAL") return null;
  return { tenantId: tenant.id, businessName: tenant.name, personalName: tenant.owner.name, cref: tenant.personalProfile?.cref ?? null };
}

export class InviteLinkError extends Error {
  constructor(
    public readonly kind: "LINK_INVALIDO" | "VALIDACAO",
    message: string
  ) {
    super(message);
    this.name = "InviteLinkError";
  }
}

/// Entra no espaço pelo link: cria o aluno, ativa a conta com a senha e
/// devolve os cabeçalhos da sessão (cookie). Qualquer falha na ativação
/// remove o aluno recém-criado.
export async function joinByInviteLink(
  input: { code: string; name: string; email: string; password: string },
  client: PrismaClient = prisma,
  authInstance?: Parameters<typeof activateStudentAccount>[1] extends infer O ? (O extends { authInstance?: infer A } ? A : never) : never
): Promise<{ studentId: string; headers: Headers }> {
  const link = await getInviteLink(input.code, client);
  if (!link) throw new InviteLinkError("LINK_INVALIDO", "Este link de convite não vale mais. Peça um novo ao seu personal.");
  if (input.password.length < 8) throw new InviteLinkError("VALIDACAO", "A senha precisa ter pelo menos 8 caracteres.");

  const owner = await client.tenant.findUniqueOrThrow({ where: { id: link.tenantId }, select: { ownerId: true } });
  const student = await createStudent({ tenantId: link.tenantId, name: input.name, email: input.email }, client);
  try {
    const { rawToken } = await generateInvitation({ tenantId: link.tenantId, studentId: student.id, actorUserId: owner.ownerId }, client);
    const result = await activateStudentAccount({ token: rawToken, password: input.password }, { client, authInstance });
    await applyInviteDefaults({ tenantId: link.tenantId, studentId: student.id, actorUserId: owner.ownerId }, client);
    return { studentId: student.id, headers: result.headers };
  } catch (error) {
    await client.invitation.deleteMany({ where: { studentId: student.id } }).catch(() => undefined);
    await client.student.delete({ where: { id: student.id } }).catch(() => undefined);
    throw error;
  }
}

export interface InviteDefaults {
  programId: string | null;
  programName: string | null;
  feeCents: number | null;
  feeDay: number | null;
}

/// O que quem entra pelo link já recebe (EPIC-33): o programa da
/// biblioteca (uma cópia só dele) e a mensalidade combinada.
export async function getInviteDefaults(tenantId: string, client: PrismaClient = prisma): Promise<InviteDefaults> {
  const tenant = await client.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { inviteProgramId: true, inviteFeeCents: true, inviteFeeDay: true } });
  const program = tenant.inviteProgramId
    ? await client.trainingPlan.findFirst({ where: { id: tenant.inviteProgramId, tenantId, status: "ATIVO", isSnapshot: false, isDraftBucket: false }, select: { name: true } })
    : null;
  return { programId: program ? tenant.inviteProgramId : null, programName: program?.name ?? null, feeCents: tenant.inviteFeeCents, feeDay: tenant.inviteFeeDay };
}

export async function setInviteDefaults(
  input: { tenantId: string; programId?: string | null; feeCents?: number | null; feeDay?: number | null },
  client: PrismaClient = prisma
): Promise<InviteDefaults> {
  const data: { inviteProgramId?: string | null; inviteFeeCents?: number | null; inviteFeeDay?: number | null } = {};
  if (input.programId !== undefined) {
    if (input.programId !== null) {
      const plan = await client.trainingPlan.findFirst({ where: { id: input.programId, tenantId: input.tenantId, status: "ATIVO", isSnapshot: false, isDraftBucket: false }, select: { id: true } });
      if (!plan) throw new InviteLinkError("VALIDACAO", "Programa não encontrado na biblioteca.");
    }
    data.inviteProgramId = input.programId;
  }
  if (input.feeCents !== undefined) {
    if (input.feeCents !== null && (!Number.isInteger(input.feeCents) || input.feeCents <= 0 || input.feeCents > 10_000_000)) {
      throw new InviteLinkError("VALIDACAO", "Valor da mensalidade inválido.");
    }
    data.inviteFeeCents = input.feeCents;
  }
  if (input.feeDay !== undefined) {
    if (input.feeDay !== null && (!Number.isInteger(input.feeDay) || input.feeDay < 1 || input.feeDay > 28)) {
      throw new InviteLinkError("VALIDACAO", "O dia de vencimento deve ser de 1 a 28.");
    }
    data.inviteFeeDay = input.feeDay;
  }
  await client.tenant.update({ where: { id: input.tenantId }, data });
  return getInviteDefaults(input.tenantId, client);
}

/// Aplica o combinado ao aluno que acabou de entrar. Melhor esforço: a
/// conta já existe; uma falha aqui é registrada e o personal ajusta à mão.
export async function applyInviteDefaults(input: { tenantId: string; studentId: string; actorUserId: string }, client: PrismaClient = prisma): Promise<void> {
  const defaults = await getInviteDefaults(input.tenantId, client);
  if (defaults.programId) {
    try {
      await applyLibraryItem({ tenantId: input.tenantId, actorUserId: input.actorUserId, kind: "programa", id: defaults.programId, studentIds: [input.studentId] }, client);
    } catch (error) {
      logEvent("warn", "convite.programa_nao_aplicado", { tenantId: input.tenantId, ...describeError(error) });
    }
  }
  if (defaults.feeCents) {
    try {
      await createChargeRecurrence({ tenantId: input.tenantId, studentId: input.studentId, description: "Mensalidade", amountReais: defaults.feeCents / 100, dueDayOfMonth: defaults.feeDay ?? 10 }, client);
    } catch (error) {
      logEvent("warn", "convite.mensalidade_nao_criada", { tenantId: input.tenantId, ...describeError(error) });
    }
  }
}
