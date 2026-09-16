import "server-only";
import { randomBytes, createHash } from "node:crypto";
import type { Invitation, PrismaClient, Student } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { getStudentForTenant } from "./students";

/// Convite e ativação — metade "personal" (FIT-015). A metade "ativação"
/// (validar token, criar a conta) vive em `src/modules/identity/activation.ts`
/// — "ativação de acesso" é responsabilidade de `identity`, não de
/// `students` (ver docs/06-engenharia/arquitetura/VISAO-ARQUITETURAL.md).
///
/// `tenantId` nunca é opcional/inferido, mesmo padrão dos demais módulos:
/// todo chamador já deve tê-lo derivado de `requirePersonal()`.

export const INVITATION_VALIDITY_DAYS = 7;

export class InvitationError extends Error {
  constructor(
    public readonly kind: "ALUNO_INATIVO" | "CONTA_JA_ATIVADA" | "NAO_ENCONTRADO",
    message: string
  ) {
    super(message);
    this.name = "InvitationError";
  }
}

/// Token bruto: 32 bytes aleatórios (`crypto.randomBytes`, CSPRNG do
/// Node/OpenSSL), codificados em base64url — nunca previsível, nunca
/// armazenado. Apenas o SHA-256 (`tokenHash`) vai para o banco.
function generateRawToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashInvitationToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export interface GenerateInvitationInput {
  tenantId: string;
  studentId: string;
  actorUserId: string;
}

/// Gera um convite para o aluno do próprio tenant. Sempre invalida
/// (cancela, nunca apaga) qualquer convite PENDENTE anterior do mesmo aluno
/// antes de criar o novo — nunca dois convites válidos simultaneamente.
/// Rejeita para aluno INATIVO ou já com conta ativada (`userId` presente) —
/// gerar um convite nesses casos não levaria a nenhuma ativação possível.
///
/// Retorna `{ invitation, rawToken }` — `rawToken` existe só neste retorno,
/// nunca é persistido, logado nem incluído em evidência. O chamador (rota)
/// monta o link com ele e descarta a variável ao final da requisição.
export async function generateInvitation(
  input: GenerateInvitationInput,
  client: PrismaClient = prisma
): Promise<{ invitation: Invitation; rawToken: string }> {
  const student = await getStudentForTenant({ tenantId: input.tenantId, studentId: input.studentId }, client);
  if (!student) {
    throw new InvitationError("NAO_ENCONTRADO", "Aluno não encontrado.");
  }
  if (student.status === "INATIVO") {
    throw new InvitationError("ALUNO_INATIVO", "Não é possível convidar um aluno inativo.");
  }
  if (student.userId) {
    throw new InvitationError("CONTA_JA_ATIVADA", "Este aluno já ativou a conta.");
  }

  const rawToken = generateRawToken();
  const tokenHash = hashInvitationToken(rawToken);
  const expiresAt = new Date(Date.now() + INVITATION_VALIDITY_DAYS * 24 * 60 * 60 * 1000);

  const [, , invitation] = await client.$transaction([
    client.invitation.updateMany({
      where: { tenantId: input.tenantId, studentId: input.studentId, status: "PENDENTE" },
      data: { status: "CANCELADO" },
    }),
    client.auditEvent.create({
      data: {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        action: "CONVITE_GERADO",
        entityType: "Student",
        entityId: input.studentId,
      },
    }),
    client.invitation.create({
      data: { tenantId: input.tenantId, studentId: input.studentId, tokenHash, expiresAt },
    }),
  ]);

  return { invitation, rawToken };
}

export interface CancelInvitationInput {
  tenantId: string;
  studentId: string;
  actorUserId: string;
}

/// Cancela o convite PENDENTE do aluno, se houver. Idempotente: se não há
/// convite pendente (nunca convidado, já aceito, já cancelado, ou expirado),
/// não é um erro — apenas não faz nada.
export async function cancelInvitation(input: CancelInvitationInput, client: PrismaClient = prisma): Promise<void> {
  const pending = await client.invitation.findFirst({
    where: { tenantId: input.tenantId, studentId: input.studentId, status: "PENDENTE" },
  });
  if (!pending) {
    return;
  }

  await client.$transaction([
    client.invitation.update({ where: { id: pending.id }, data: { status: "CANCELADO" } }),
    client.auditEvent.create({
      data: {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        action: "CONVITE_CANCELADO",
        entityType: "Student",
        entityId: input.studentId,
      },
    }),
  ]);
}

/// Convite mais recente do aluno (qualquer status), para exibição no
/// perfil — nunca o token, apenas metadados (status, validade).
export async function getLatestInvitationForStudent(
  input: { tenantId: string; studentId: string },
  client: PrismaClient = prisma
): Promise<Invitation | null> {
  return client.invitation.findFirst({
    where: { tenantId: input.tenantId, studentId: input.studentId },
    orderBy: { createdAt: "desc" },
  });
}

export type StudentAccessStatus =
  | "NAO_CONVIDADO"
  | "CONVITE_PENDENTE"
  | "CONVITE_EXPIRADO"
  | "CONVITE_CANCELADO"
  | "CONTA_ATIVA";

/// Deriva o "estado de acesso" apresentado na interface — sempre calculado,
/// nunca uma coluna própria (ver nota em `InvitationStatus` no schema:
/// "convite expirado" é `expiresAt < now()` sobre um PENDENTE, não um
/// estado persistido). `CONTA_ATIVA` é decidido por `student.userId`, não
/// por `invitation.status === "ACEITO"` — os dois são preenchidos na mesma
/// transação (`activateStudentAccount`), mas `userId` é a fonte mais direta
/// e já teria de ser consultada de qualquer forma.
/// Função utilitária comum (não um componente/hook) — mantém a chamada a
/// `Date.now()` fora do corpo de qualquer Server/Client Component, exigido
/// pela regra `react-hooks/purity` do ESLint (que trata qualquer chamada a
/// uma função impura escrita diretamente dentro de um componente como uma
/// violação de pureza, mesmo em Server Components).
export function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function deriveAccessStatus(student: Student, latestInvitation: Invitation | null): StudentAccessStatus {
  if (student.userId) {
    return "CONTA_ATIVA";
  }
  if (!latestInvitation) {
    return "NAO_CONVIDADO";
  }
  if (latestInvitation.status === "CANCELADO") {
    return "CONVITE_CANCELADO";
  }
  // status PENDENTE (ACEITO é impossível aqui: teria preenchido student.userId).
  return latestInvitation.expiresAt < new Date() ? "CONVITE_EXPIRADO" : "CONVITE_PENDENTE";
}
