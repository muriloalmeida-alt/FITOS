import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/shared/db/prisma";
import { ensureTenantForPersonal } from "@/modules/tenancy/ensureTenantForPersonal";

/// Único ponto de configuração do provedor de autenticação (Better Auth).
/// Nenhum outro módulo deve importar `better-auth` diretamente — server
/// actions, rotas e páginas usam `auth` (aqui) ou `authClient`
/// (`auth-client.ts`), nunca a biblioteca crua. Isso é o que permite trocar
/// de provedor (ex.: Clerk, se a prova técnica falhar) sem reescrever os
/// módulos de negócio — ver docs/06-engenharia/arquitetura/
/// AUTENTICACAO-E-SESSAO.md.
function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Variável de ambiente obrigatória ausente: ${name}. Configure-a em .env a partir de .env.example.`
    );
  }
  return value;
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: requiredEnv("BETTER_AUTH_SECRET"),
  baseURL: requiredEnv("BETTER_AUTH_URL"),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    // Sem verificação de e-mail nem recuperação de senha por e-mail nesta
    // História: exigiria decidir um provedor de envio de e-mail, fora do
    // escopo da FIT-009 (ver AUTENTICACAO-E-SESSAO.md, "Limitações
        // conhecidas").
    autoSignIn: true,
  },
  user: {
    additionalFields: {
      // Nunca aceito do cliente (`input: false`): definido pelo servidor no
      // momento do cadastro. O cadastro público (`/criar-conta`) só cria
      // PERSONAL; contas ALUNO dependem de um fluxo de vínculo/convite fora
      // do escopo desta História (FIT-010/011).
      role: {
        type: "string",
        required: true,
        defaultValue: "PERSONAL",
        input: false,
      },
    },
  },
  session: {
    // Sessão persistente com expiração e renovação — 7 dias, renovada a
    // cada acesso com menos de 1 dia restante.
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  advanced: {
    database: {
      // Deixa o Prisma gerar o id (cuid), consistente com o restante do
      // schema físico (Tenant, Student, etc. também usam @default(cuid())).
      generateId: false,
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Provisionamento automático do tenant do personal (FIT-010): este
        // hook roda depois que o usuário já foi inserido (não faz parte da
        // mesma transação SQL do Better Auth), então uma falha aqui nunca
        // impede o cadastro em si — o usuário já existe. Se a criação do
        // tenant falhar (ex.: banco indisponível no instante exato), o
        // personal fica temporariamente sem tenant; isso é reparado de
        // forma idempotente na próxima vez que `provisionTenantForCurrentSession`
        // for chamado (ver `/painel` e `PROVISIONAMENTO-DE-TENANT.md`) —
        // por isso o erro é apenas registrado, não relançado.
        after: async (user) => {
          if (user.role !== "PERSONAL") {
            return;
          }
          try {
            await ensureTenantForPersonal({ id: user.id, name: user.name, role: user.role });
          } catch {
            console.error("[FIT-010] Falha ao provisionar tenant automaticamente no cadastro", {
              userId: user.id,
            });
          }
        },
      },
    },
  },
  // Cookies httpOnly, sameSite=lax e secure em produção são o padrão do
  // Better Auth; não sobrescritos aqui. `nextCookies()` precisa ser o
  // último plugin da lista (exigência do próprio Better Auth) para
  // interceptar as respostas de Server Actions e propagar os cookies de
  // sessão corretamente no App Router.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
