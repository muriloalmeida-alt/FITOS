/**
 * Gera as variáveis de ambiente de produção (formato .env, para colar no
 * Raw Editor do Railway). Segredos novos a cada execução:
 * PAYMENT_KEYS_SECRET, API_ASAAS_WEBHOOK_TOKEN, ADMIN_PASSWORD e o par
 * VAPID. Valores fixos de produção (domínio, Asaas, Resend, R2).
 *
 * Chaves de serviços externos (Resend, Asaas, Sentry) não podem ser
 * geradas aqui: saem comentadas, para preencher com o valor do painel de
 * cada serviço. Linhas comentadas não criam variável vazia no Railway.
 *
 * Nunca versionar a saída. Uso:
 *   npm run -s producao:variaveis -- --admin-email=voce@exemplo.com > producao.env
 *
 * Não inclui DATABASE_URL nem BETTER_AUTH_SECRET, que já existem em
 * produção e não devem ser trocados.
 */
import { randomBytes } from "node:crypto";
import webpush from "web-push";

const DOMAIN = "https://app.fitosx.com.br";

function argument(name: string): string | null {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length).trim() || null;
}

export function productionEnv(input: { adminEmail: string | null; contactEmail: string | null; random?: (bytes: number) => Buffer; vapid?: { publicKey: string; privateKey: string } }): string {
  const random = input.random ?? randomBytes;
  const vapid = input.vapid ?? webpush.generateVAPIDKeys();
  const contact = input.contactEmail ?? input.adminEmail;
  const lines = [
    "# FitOS — variáveis de produção. NÃO versionar. Gerado em " + new Date().toISOString(),
    "# DATABASE_URL e BETTER_AUTH_SECRET já existem no Railway: não trocar.",
    "",
    "# Aplicação",
    `BETTER_AUTH_URL=${DOMAIN}`,
    "NEXT_PUBLIC_APP_ENV=production",
    "R2_PUBLIC_BASE_URL=https://pub-76bc00d74c5a4bf98ccac51eb4c92de3.r2.dev",
    `PAYMENT_KEYS_SECRET=${random(32).toString("base64")}`,
    "",
    "# Administrador (criado no deploy por admin:garantir)",
    input.adminEmail ? `ADMIN_EMAIL=${input.adminEmail}` : "# ADMIN_EMAIL=<seu e-mail de admin; não pode ser de outra conta do FitOS>",
    `ADMIN_PASSWORD=${random(18).toString("base64url")}`,
    "",
    "# Notificações push",
    `VAPID_PUBLIC_KEY=${vapid.publicKey}`,
    `VAPID_PRIVATE_KEY=${vapid.privateKey}`,
    contact ? `VAPID_SUBJECT=mailto:${contact}` : "# VAPID_SUBJECT=mailto:<e-mail de contato>",
    "",
    "# E-mail (Resend)",
    "EMAIL_FROM=FitOS <nao-responda@fitosx.com.br>",
    "# RESEND_API_KEY=<chave do painel do Resend>",
    "",
    "# Asaas — descomentar as três juntas, só depois dos runbooks no Sandbox.",
    "# O token do webhook é o mesmo cadastrado no painel do Asaas.",
    "# API_ASAAS=<chave de produção do Asaas>",
    "# ASAAS_BASE_URL=https://api.asaas.com/v3",
    `# API_ASAAS_WEBHOOK_TOKEN=${random(32).toString("hex")}`,
    "",
    "# Monitoramento (opcional) — o mesmo DSN nas duas",
    "# SENTRY_DSN=<DSN do projeto no sentry.io>",
    "# NEXT_PUBLIC_SENTRY_DSN=<o mesmo DSN>",
  ];
  return `${lines.join("\n")}\n`;
}

if (process.argv[1]?.includes("gerar-variaveis-producao")) {
  process.stdout.write(productionEnv({ adminEmail: argument("admin-email"), contactEmail: argument("contato") }));
}
