import "server-only";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { auth } from "./auth";
import { hashInvitationToken } from "@/modules/students/invitations";

/// Ativação de conta do aluno (FIT-015) — metade "identidade" do fluxo de
/// convite (a metade "personal" — gerar/cancelar convite — vive em
/// `students/invitations.ts`). "Ativação de acesso" é responsabilidade de
/// `identity` (VISAO-ARQUITETURAL.md).
///
/// `authInstance`/`client` seguem o mesmo padrão de DI dos demais módulos —
/// exclusivos para testes contra o banco de testes com uma instância própria
/// do Better Auth (ver `identity.integration.test.ts`).

export class ActivationError extends Error {
  constructor(
    public readonly kind: "TOKEN_INVALIDO" | "EMAIL_EM_USO",
    message: string
  ) {
    super(message);
    this.name = "ActivationError";
  }
}

export interface ActivationTokenCheck {
  valid: boolean;
  studentName?: string;
}

/// Validação **somente leitura** do token, para a página pública decidir o
/// que renderizar (formulário de senha vs. "link inválido"). Nunca muta
/// nada — a reivindicação atômica de verdade acontece em
/// `activateStudentAccount`. Nunca retorna nenhum dado do aluno quando o
/// token é inválido/expirado/usado/cancelado — apenas `{ valid: false }`.
export async function checkActivationToken(token: string, client: PrismaClient = prisma): Promise<ActivationTokenCheck> {
  const tokenHash = hashInvitationToken(token);
  const invitation = await client.invitation.findUnique({ where: { tokenHash }, include: { student: true } });

  if (!invitation || invitation.status !== "PENDENTE" || invitation.expiresAt < new Date() || invitation.student.userId) {
    return { valid: false };
  }

  return { valid: true, studentName: invitation.student.displayName };
}

export interface ActivateStudentAccountInput {
  token: string;
  password: string;
}

export interface ActivateStudentAccountResult {
  studentId: string;
  tenantId: string;
  /// Cabeçalhos reais da resposta de `signUpEmail` (inclui `Set-Cookie` da
  /// sessão já autenticada — `autoSignIn: true`). A rota HTTP repassa esses
  /// cabeçalhos para o navegador do aluno, evitando pedir a senha de novo.
  headers: Headers;
}

/// Ativa a conta do aluno a partir de um token de convite válido.
///
/// Ordem deliberada (segurança sob concorrência — dois cliques no mesmo
/// link, ou replay):
/// 1. Valida o token (existe, PENDENTE, não expirado, aluno ainda sem
///    conta).
/// 2. **Reivindica o convite atomicamente** (`updateMany` condicionado a
///    `status: "PENDENTE"`, com `count` verificado) — isso acontece ANTES
///    de qualquer chamada ao Better Auth. Uma segunda requisição concorrente
///    nunca encontra `count === 1` de novo, então nunca chega a criar uma
///    conta — não há usuário "perdedor" órfão para limpar.
/// 3. Só então cria a conta (`signUpEmail`, que também dispara o hook de
///    provisionamento automático de tenant da FIT-010 — o hook assume
///    `PERSONAL`, então o tenant criado por engano é desfeito na mesma
///    transação que corrige o papel para `ALUNO` e vincula o `Student`).
/// 4. Se qualquer etapa depois da reivindicação falhar (ex.: e-mail já em
///    uso por uma conta criada nesse intervalo), o convite volta para
///    PENDENTE (best-effort) para que o aluno possa tentar de novo.
/// `authInstance` é tipado estruturalmente (apenas o formato de
/// `api.signUpEmail` que esta função de fato usa) em vez de `typeof auth` —
/// isso permite que os testes construam uma instância de Better Auth com
/// uma configuração diferente (sem `databaseHooks`/`session`/`plugins`,
/// ver `activation.integration.test.ts`) sem um erro de tipo por causa do
/// generic exato do `betterAuth()` de produção.
type SignUpEmailCompatibleAuth = { api: Pick<typeof auth.api, "signUpEmail"> };

export async function activateStudentAccount(
  input: ActivateStudentAccountInput,
  options: { authInstance?: SignUpEmailCompatibleAuth; client?: PrismaClient } = {}
): Promise<ActivateStudentAccountResult> {
  const authInstance = options.authInstance ?? auth;
  const client = options.client ?? prisma;

  const tokenHash = hashInvitationToken(input.token);
  const invitation = await client.invitation.findUnique({ where: { tokenHash } });

  if (!invitation || invitation.status !== "PENDENTE" || invitation.expiresAt < new Date()) {
    throw new ActivationError("TOKEN_INVALIDO", "Este link não é válido ou já expirou.");
  }

  const claim = await client.invitation.updateMany({
    where: { id: invitation.id, status: "PENDENTE" },
    data: { status: "ACEITO", acceptedAt: new Date() },
  });
  if (claim.count !== 1) {
    // Perdeu a corrida para outra requisição (ou foi cancelado entre a
    // leitura e aqui) — mesma mensagem genérica, não distingue o motivo.
    throw new ActivationError("TOKEN_INVALIDO", "Este link não é válido ou já expirou.");
  }

  try {
    const student = await client.student.findUniqueOrThrow({ where: { id: invitation.studentId } });
    if (student.userId) {
      throw new ActivationError("TOKEN_INVALIDO", "Este link não é válido ou já expirou.");
    }

    const existingAccount = await client.user.findUnique({ where: { email: student.email } });
    if (existingAccount) {
      throw new ActivationError("EMAIL_EM_USO", "O e-mail deste convite já está em uso por outra conta. Contate seu personal.");
    }

    const signUp = await authInstance.api.signUpEmail({
      body: { email: student.email, password: input.password, name: student.displayName },
      returnHeaders: true,
    });

    const [, , linkResult] = await client.$transaction([
      client.tenant.deleteMany({ where: { ownerId: signUp.response.user.id } }),
      client.user.update({ where: { id: signUp.response.user.id }, data: { role: "ALUNO" } }),
      client.student.updateMany({
        where: { id: student.id, userId: null },
        data: { userId: signUp.response.user.id },
      }),
    ]);
    if (linkResult.count !== 1) {
      // Extremamente improvável (o convite já foi reivindicado com
      // exclusividade acima), mas nunca deixa um User órfão sem vínculo se
      // acontecer mesmo assim.
      throw new Error("Não foi possível vincular a conta ao aluno.");
    }

    return { studentId: student.id, tenantId: student.tenantId, headers: signUp.headers };
  } catch (error) {
    await client.invitation
      .update({ where: { id: invitation.id }, data: { status: "PENDENTE", acceptedAt: null } })
      .catch(() => {});
    throw error;
  }
}
