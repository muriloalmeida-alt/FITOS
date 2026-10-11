import "server-only";
import type { PrismaClient } from "@prisma/client";
import { verifyPassword } from "better-auth/crypto";
import { prisma } from "@/shared/db/prisma";

/// Dados da própria conta (FIT-155; reaproveitado pelo FitOS Livre): nome
/// e e-mail de acesso. Sem verificação de e-mail configurada no produto,
/// trocar o e-mail exige a senha atual. No aluno, o nome e o e-mail do
/// cadastro no personal acompanham a conta.

export class OwnAccountError extends Error {
  constructor(
    public readonly kind: "VALIDACAO" | "SENHA_INCORRETA" | "EMAIL_EM_USO",
    message: string
  ) {
    super(message);
    this.name = "OwnAccountError";
  }
}

const MAX_NAME = 120;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function updateOwnName(input: { userId: string; name: string }, client: PrismaClient = prisma): Promise<void> {
  const name = input.name.trim();
  if (name.length === 0 || name.length > MAX_NAME) throw new OwnAccountError("VALIDACAO", "Informe seu nome.");
  await client.$transaction([
    client.user.update({ where: { id: input.userId }, data: { name } }),
    client.student.updateMany({ where: { userId: input.userId }, data: { displayName: name } }),
  ]);
}

export async function changeOwnEmail(input: { userId: string; email: string; password: string }, client: PrismaClient = prisma): Promise<void> {
  const email = input.email.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) throw new OwnAccountError("VALIDACAO", "Informe um e-mail válido.");
  const account = await client.account.findFirst({ where: { userId: input.userId, providerId: "credential" } });
  if (!account?.password || !(await verifyPassword({ hash: account.password, password: input.password }))) {
    throw new OwnAccountError("SENHA_INCORRETA", "Senha incorreta.");
  }
  const user = await client.user.findUniqueOrThrow({ where: { id: input.userId } });
  if (user.email === email) return;
  const taken = await client.user.findUnique({ where: { email } });
  if (taken) throw new OwnAccountError("EMAIL_EM_USO", "Este e-mail já está em uso em outra conta.");
  const student = await client.student.findUnique({ where: { userId: input.userId } });
  if (student) {
    const clash = await client.student.findFirst({ where: { tenantId: student.tenantId, email, id: { not: student.id } } });
    if (clash) throw new OwnAccountError("EMAIL_EM_USO", "Seu personal já tem outro aluno com este e-mail.");
  }
  await client.$transaction([
    client.user.update({ where: { id: input.userId }, data: { email } }),
    ...(student ? [client.student.update({ where: { id: student.id }, data: { email } })] : []),
  ]);
}
