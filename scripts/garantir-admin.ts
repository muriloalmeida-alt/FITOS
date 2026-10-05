/**
 * Garante a conta de administrador da plataforma a partir das variáveis
 * ADMIN_EMAIL e ADMIN_PASSWORD (opcional: ADMIN_NAME). Roda a cada deploy
 * (`railway.json`, `deploy.preDeployCommand`), depois das migrations.
 *
 * Idempotente e nunca derruba o deploy: sem as variáveis, não faz nada; se
 * o admin já existe, mantém a senha (com ADMIN_RESET_PASSWORD=true, troca
 * pela de ADMIN_PASSWORD); se o e-mail já é de outra conta (personal, aluno
 * ou Livre), recusa e avisa no log. Nunca escreve a senha no log.
 *
 * Uso manual: ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run admin:garantir
 */
import { PrismaClient } from "@prisma/client";
import { ensureAdminAccount, suspiciousEdges } from "../src/modules/admin/bootstrap";

const MESSAGES = {
  SEM_CONFIGURACAO: "ADMIN_EMAIL/ADMIN_PASSWORD não configuradas neste serviço; nada a fazer.",
  CRIADO: "conta de administrador criada.",
  JA_EXISTE: "conta de administrador já existe; senha mantida. Para trocar pela de ADMIN_PASSWORD, defina ADMIN_RESET_PASSWORD=true e faça um novo deploy.",
  SENHA_REDEFINIDA: "senha do administrador redefinida para a de ADMIN_PASSWORD. Remova ADMIN_RESET_PASSWORD.",
  CONFLITO: "o e-mail de ADMIN_EMAIL já pertence a uma conta que não é de administrador; nada foi alterado. Use outro e-mail.",
} as const;

async function main(): Promise<void> {
  const email = process.env.ADMIN_EMAIL ?? "";
  const password = process.env.ADMIN_PASSWORD ?? "";
  const resetPassword = process.env.ADMIN_RESET_PASSWORD?.trim().toLowerCase() === "true";
  console.log(`[admin:garantir] ADMIN_EMAIL=${email ? `"${email.trim().toLowerCase()}"` : "(vazia)"} · ADMIN_PASSWORD com ${password.length} caractere(s) · ADMIN_RESET_PASSWORD=${resetPassword}`);
  if (suspiciousEdges(email) || suspiciousEdges(password)) {
    console.warn("[admin:garantir] atenção: ADMIN_EMAIL ou ADMIN_PASSWORD começa ou termina com aspas ou espaço. No Railway, cole o valor sem aspas; elas viram parte da senha.");
  }
  const prisma = new PrismaClient();
  try {
    const result = await ensureAdminAccount({ email, password, name: process.env.ADMIN_NAME, resetPassword }, prisma);
    console.log(`[admin:garantir] ${MESSAGES[result]}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  // Nunca bloqueia o deploy por causa do admin.
  console.error("[admin:garantir] falha:", error instanceof Error ? error.message : error);
});
