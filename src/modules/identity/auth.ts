import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import * as z from "zod";
import { prisma } from "@/shared/db/prisma";
import { ensureTenantForPersonal } from "@/modules/tenancy/ensureTenantForPersonal";
import { ensureTenantForIndividual } from "@/modules/tenancy/ensureTenantForIndividual";

/// Papéis que uma pessoa pode escolher livremente no cadastro público
/// (FIT-101): `PERSONAL` (já existia, era o único valor possível) e
/// `INDIVIDUAL` (workspace do FitOS Livre, FIT-100). Nunca `ALUNO` — esse
/// papel só existe por convite de um personal (FIT-015); permitir que o
/// próprio cadastro público o produza permitiria a qualquer pessoa se
/// autoconceder acesso como aluno de qualquer tenant, contornando o fluxo
/// de convite/ativação inteiro. Ver `ADR-007-SELECAO-DE-PAPEL-NO-CADASTRO.md`.
const SELF_SERVICE_ROLES = z.enum(["PERSONAL", "INDIVIDUAL"]);

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
      // FIT-101: aceito do cliente (`input: true`), mas restrito por
      // `validator.input` a `SELF_SERVICE_ROLES` — qualquer outro valor
      // (em especial `"ALUNO"`, mas também qualquer string arbitrária) é
      // rejeitado com 400 antes de chegar ao banco. `/criar-conta` (modo
      // padrão, sem escolha) e `/criar-conta?modo=individual` (FIT-101) são
      // as duas únicas rotas públicas que chamam `signUp.email`; nenhuma
      // delas jamais repassa um valor vindo de query string/payload do
      // usuário além de exatamente `"PERSONAL"` ou `"INDIVIDUAL"` — a
      // validação aqui é defesa em profundidade, não a única barreira.
      role: {
        type: "string",
        required: true,
        defaultValue: "PERSONAL",
        input: true,
        validator: { input: SELF_SERVICE_ROLES },
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
          if (user.role === "PERSONAL") {
            try {
              await ensureTenantForPersonal({ id: user.id, name: user.name, role: user.role });
            } catch {
              console.error("[FIT-010] Falha ao provisionar tenant automaticamente no cadastro", {
                userId: user.id,
              });
            }
            return;
          }
          if (user.role === "INDIVIDUAL") {
            try {
              await ensureTenantForIndividual({ id: user.id, name: user.name, role: user.role });
            } catch {
              console.error("[FIT-100] Falha ao provisionar workspace individual automaticamente no cadastro", {
                userId: user.id,
              });
            }
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
