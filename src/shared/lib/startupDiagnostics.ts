import { readdir } from "node:fs/promises";
import path from "node:path";
import { describeError, logEvent } from "./serverLog";

const REQUIRED_ENV = ["DATABASE_URL", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL"];
/// Usadas pelo app em execução. As credenciais de escrita do R2
/// (`R2_ENDPOINT`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`,
/// `R2_SECRET_ACCESS_KEY`) ficam de fora: só o script manual de imagens as
/// usa; fotos e vídeos do app ficam no banco.
export const OPTIONAL_ENV = [
  "NEXT_PUBLIC_APP_ENV",
  "API_ASAAS",
  "API_ASAAS_WEBHOOK_TOKEN",
  "ASAAS_BASE_URL",
  "PAYMENT_KEYS_SECRET",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "R2_PUBLIC_BASE_URL",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
  "SENTRY_DSN",
  "NEXT_PUBLIC_SENTRY_DSN",
];

/// Ambiente do Asaas em uso: chave de produção com o Sandbox (ou o
/// contrário) é configuração errada, nunca uma escolha.
export function asaasEnvironment(env: Record<string, string | undefined> = process.env): "sandbox" | "producao" {
  return env.ASAAS_BASE_URL?.includes("api.asaas.com") ? "producao" : "sandbox";
}

/// Roda uma vez na subida (instrumentation `register`). Nunca derruba o
/// servidor: qualquer falha aqui vira uma linha de log.
export async function runStartupDiagnostics(): Promise<void> {
  try {
    const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
    const optionalMissing = OPTIONAL_ENV.filter((name) => !process.env[name]);
    logEvent(missing.length > 0 ? "error" : "info", "startup", {
      node: process.version,
      nodeEnv: process.env.NODE_ENV,
      missingEnv: missing,
      optionalMissingEnv: optionalMissing,
      betterAuthUrl: process.env.BETTER_AUTH_URL,
      appEnv: process.env.NEXT_PUBLIC_APP_ENV ?? null,
      asaas: process.env.API_ASAAS ? asaasEnvironment() : "sem_chave",
      email: process.env.RESEND_API_KEY ? "resend" : "desligado",
    });
  } catch (error) {
    logEvent("error", "startup_env_check_failed", describeError(error));
  }

  try {
    const { prisma } = await import("@/shared/db/prisma");
    await prisma.$queryRaw`SELECT 1`;
    const applied = await prisma.$queryRaw<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }[]>`
      SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations"`;
    const done = new Set(applied.filter((row) => row.finished_at && !row.rolled_back_at).map((row) => row.migration_name));
    const failed = applied.filter((row) => !row.finished_at && !row.rolled_back_at).map((row) => row.migration_name);
    let pending: string[] = [];
    try {
      const dir = path.join(process.cwd(), "prisma", "migrations");
      pending = (await readdir(dir, { withFileTypes: true })).filter((entry) => entry.isDirectory() && !done.has(entry.name)).map((entry) => entry.name);
    } catch {
      // Pasta de migrações fora da imagem: só não dá para comparar.
    }
    const plans = await prisma.plan.count({ where: { active: true } });
    const admins = await prisma.user.count({ where: { role: "ADMIN" } });
    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const adminEmailAccount = adminEmail ? await prisma.user.findUnique({ where: { email: adminEmail }, select: { role: true, accounts: { where: { providerId: "credential" }, select: { id: true } } } }) : null;
    logEvent(failed.length > 0 || pending.length > 0 ? "error" : "info", "startup_database", {
      ok: true,
      appliedMigrations: done.size,
      failedMigrations: failed,
      pendingMigrations: pending,
      activePlans: plans,
      admins,
      // Diagnóstico do login do admin: a conta de ADMIN_EMAIL existe, é
      // ADMIN e tem senha?
      adminEmailAccount: adminEmail ? (adminEmailAccount ? { role: adminEmailAccount.role, hasPassword: adminEmailAccount.accounts.length > 0 } : "nao_existe") : "sem_ADMIN_EMAIL",
    });
  } catch (error) {
    logEvent("error", "startup_database", { ok: false, ...describeError(error) });
  }
}
