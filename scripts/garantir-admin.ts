/**
 * Garante a conta de administrador da plataforma a partir das variáveis
 * ADMIN_EMAIL e ADMIN_PASSWORD (opcional: ADMIN_NAME). Roda a cada deploy
 * (`railway.json`, `deploy.preDeployCommand`), depois das migrations.
 *
 * Idempotente e nunca derruba o deploy: sem as variáveis, não faz nada; se
 * o admin já existe, não mexe na senha; se o e-mail já é de outra conta
 * (personal, aluno ou Livre), recusa e avisa no log.
 *
 * Uso manual: ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run admin:garantir
 */
import { PrismaClient } from "@prisma/client";
import { ensureAdminAccount } from "../src/modules/admin/bootstrap";

const MESSAGES = {
  SEM_CONFIGURACAO: "ADMIN_EMAIL/ADMIN_PASSWORD não configuradas; nada a fazer.",
  CRIADO: "conta de administrador criada.",
  JA_EXISTE: "conta de administrador já existe; senha mantida.",
  CONFLITO: "o e-mail de ADMIN_EMAIL já pertence a uma conta que não é de administrador; nada foi alterado. Use outro e-mail.",
} as const;

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const result = await ensureAdminAccount({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD, name: process.env.ADMIN_NAME }, prisma);
    console.log(`[admin:garantir] ${MESSAGES[result]}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  // Nunca bloqueia o deploy por causa do admin.
  console.error("[admin:garantir] falha:", error instanceof Error ? error.message : error);
});
