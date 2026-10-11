import type { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

export type EnsureAdminResult = "SEM_CONFIGURACAO" | "CRIADO" | "JA_EXISTE" | "SENHA_REDEFINIDA" | "CONFLITO";

/// Aspas ou espaços nas pontas do valor (comum ao colar no painel do
/// Railway) viram parte da senha e o login falha sem explicação.
export function suspiciousEdges(value: string): boolean {
  return /^["'\s]|["'\s]$/.test(value);
}

/// Garante a conta de administrador a partir de ADMIN_EMAIL/ADMIN_PASSWORD
/// (script `admin:garantir`, roda a cada deploy). Idempotente: não troca a
/// senha de um admin que já existe, a menos que `resetPassword` (variável
/// ADMIN_RESET_PASSWORD=true) peça; nunca promove uma conta existente de
/// personal, aluno ou Livre.
export async function ensureAdminAccount(
  input: { email?: string; password?: string; name?: string; resetPassword?: boolean },
  client: PrismaClient
): Promise<EnsureAdminResult> {
  const email = input.email?.trim().toLowerCase() ?? "";
  const password = input.password ?? "";
  if (!email || !password) return "SEM_CONFIGURACAO";
  if (password.length < 8 || password.length > 128) throw new Error("ADMIN_PASSWORD precisa ter entre 8 e 128 caracteres.");

  const existing = await client.user.findUnique({ where: { email }, select: { id: true, role: true } });
  if (existing && existing.role !== "ADMIN") return "CONFLITO";

  const hash = await hashPassword(password);
  if (existing) {
    if (!input.resetPassword) return "JA_EXISTE";
    await client.$transaction(async (tx) => {
      const credential = await tx.account.findFirst({ where: { userId: existing.id, providerId: "credential" } });
      if (credential) await tx.account.update({ where: { id: credential.id }, data: { password: hash, accountId: existing.id } });
      else await tx.account.create({ data: { userId: existing.id, providerId: "credential", accountId: existing.id, password: hash } });
      await tx.session.deleteMany({ where: { userId: existing.id } });
    });
    return "SENHA_REDEFINIDA";
  }

  // Mesma convenção do Better Auth: na credencial, accountId = id do usuário.
  await client.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { email, name: input.name?.trim() || "Administrador", role: "ADMIN", emailVerified: true } });
    await tx.account.create({ data: { userId: user.id, providerId: "credential", accountId: user.id, password: hash } });
  });
  return "CRIADO";
}
