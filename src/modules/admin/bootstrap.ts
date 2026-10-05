import type { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

export type EnsureAdminResult = "SEM_CONFIGURACAO" | "CRIADO" | "JA_EXISTE" | "CONFLITO";

/// Garante a conta de administrador a partir de ADMIN_EMAIL/ADMIN_PASSWORD
/// (script `admin:garantir`, roda a cada deploy). Idempotente: nunca troca
/// a senha de um admin que já existe (a troca é pela própria tela) e nunca
/// promove uma conta existente de personal, aluno ou Livre.
export async function ensureAdminAccount(input: { email?: string; password?: string; name?: string }, client: PrismaClient): Promise<EnsureAdminResult> {
  const email = input.email?.trim().toLowerCase() ?? "";
  const password = input.password ?? "";
  if (!email || !password) return "SEM_CONFIGURACAO";
  if (password.length < 8 || password.length > 128) throw new Error("ADMIN_PASSWORD precisa ter entre 8 e 128 caracteres.");

  const existing = await client.user.findUnique({ where: { email }, select: { role: true } });
  if (existing) return existing.role === "ADMIN" ? "JA_EXISTE" : "CONFLITO";

  const hash = await hashPassword(password);
  // Mesma convenção do Better Auth: na credencial, accountId = id do usuário.
  await client.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { email, name: input.name?.trim() || "Administrador", role: "ADMIN", emailVerified: true } });
    await tx.account.create({ data: { userId: user.id, providerId: "credential", accountId: user.id, password: hash } });
  });
  return "CRIADO";
}
