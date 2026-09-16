import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/shared/db/prisma";

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
  // Cookies httpOnly, sameSite=lax e secure em produção são o padrão do
  // Better Auth; não sobrescritos aqui. `nextCookies()` precisa ser o
  // último plugin da lista (exigência do próprio Better Auth) para
  // interceptar as respostas de Server Actions e propagar os cookies de
  // sessão corretamente no App Router.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
