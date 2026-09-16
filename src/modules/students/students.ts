import "server-only";
import type { PrismaClient, Student, StudentStatus } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";

/// Camada de domínio de alunos (FIT-013): cadastro e listagem. `tenantId`
/// nunca é um parâmetro opcional/inferido — todo chamador já deve tê-lo
/// derivado do contexto de autorização da sessão (`requirePersonal`,
/// FIT-011) antes de chamar qualquer função deste módulo. Nenhuma função
/// aqui aceita um `tenantId` vindo de payload/query/header por conta
/// própria; quem decide isso é sempre a camada de autorização, nunca este
/// módulo.
///
/// `client: PrismaClient = prisma` segue o mesmo padrão de DI já usado em
/// `tenancy` (FIT-010/011), exclusivamente para testes contra o banco de
/// testes.

export class StudentError extends Error {
  constructor(
    public readonly kind:
      | "EMAIL_DUPLICADO_NO_TENANT"
      | "EMAIL_JA_POSSUI_CONTA"
      | "VALIDACAO"
      | "EMAIL_BLOQUEADO_POS_ATIVACAO"
      | "NAO_ENCONTRADO",
    message: string
  ) {
    super(message);
    this.name = "StudentError";
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeName(name: string): string {
  return name.trim();
}

export interface CreateStudentInput {
  tenantId: string;
  name: string;
  email: string;
}

/// Cadastra um aluno no tenant informado. O aluno criado começa `ATIVO` e
/// sem `userId` (não convidado — o convite é escopo da FIT-015). Nunca
/// envia convite, nunca cria sessão, nunca cria User.
///
/// Duas verificações de duplicidade, deliberadamente distintas:
/// - mesmo e-mail já cadastrado **neste tenant**: rejeitado como erro de
///   domínio específico (o personal está tentando cadastrar o mesmo aluno
///   duas vezes) — a constraint física `@@unique([tenantId, email])`
///   garante isso mesmo sob concorrência; a violação é traduzida aqui.
/// - e-mail já pertence a uma conta (`User`) existente em **qualquer**
///   tenant: rejeitado com mensagem genérica, sem revelar em qual tenant a
///   conta existe — evita cadastrar um aluno cuja ativação (FIT-015) seria
///   impossível (e-mail já é a credencial de outra conta) e evita vazar a
///   existência de dados de outro tenant.
export async function createStudent(input: CreateStudentInput, client: PrismaClient = prisma): Promise<Student> {
  const name = normalizeName(input.name);
  const email = normalizeEmail(input.email);

  if (name.length === 0) {
    throw new StudentError("VALIDACAO", "Informe o nome do aluno.");
  }
  if (!EMAIL_PATTERN.test(email)) {
    throw new StudentError("VALIDACAO", "Informe um e-mail válido.");
  }

  const existingAccount = await client.user.findUnique({ where: { email } });
  if (existingAccount) {
    throw new StudentError("EMAIL_JA_POSSUI_CONTA", "Este e-mail já possui uma conta no FitOS.");
  }

  try {
    return await client.student.create({
      data: { tenantId: input.tenantId, email, displayName: name },
    });
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      throw new StudentError("EMAIL_DUPLICADO_NO_TENANT", "Já existe um aluno com este e-mail na sua carteira.");
    }
    throw error;
  }
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

export type StudentSortOrder = "nome_asc" | "recente";

export interface ListStudentsInput {
  tenantId: string;
  search?: string;
  status?: StudentStatus;
  page?: number;
  pageSize?: number;
  sort?: StudentSortOrder;
}

export interface ListStudentsResult {
  items: Student[];
  total: number;
  page: number;
  pageSize: number;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/// Listagem paginada no servidor, sempre restrita a `tenantId`. Busca por
/// nome ou e-mail (case-insensitive, substring); filtro opcional por
/// status; ordenação estável (nome ascendente por padrão, com `id` como
/// critério de desempate — necessário para que a paginação nunca repita ou
/// pule um registro quando dois alunos têm o mesmo nome).
export async function listStudents(input: ListStudentsInput, client: PrismaClient = prisma): Promise<ListStudentsResult> {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, input.pageSize ?? DEFAULT_PAGE_SIZE));
  const search = input.search?.trim();

  const where = {
    tenantId: input.tenantId,
    ...(input.status ? { status: input.status } : {}),
    ...(search
      ? {
          OR: [
            { displayName: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const orderBy =
    input.sort === "recente"
      ? [{ createdAt: "desc" as const }, { id: "asc" as const }]
      : [{ displayName: "asc" as const }, { id: "asc" as const }];

  const [items, total] = await Promise.all([
    client.student.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    client.student.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

/// Busca um aluno **apenas se pertencer ao tenant informado** — nunca busca
/// por `id` isoladamente. Retorna `null` (não lança) quando o aluno não
/// existe ou pertence a outro tenant; o chamador (rota/página) decide
/// tratar isso como 404, sem revelar se o `id` existe em outro tenant.
export async function getStudentForTenant(
  input: { tenantId: string; studentId: string },
  client: PrismaClient = prisma
): Promise<Student | null> {
  return client.student.findFirst({ where: { id: input.studentId, tenantId: input.tenantId } });
}

export interface UpdateStudentInput {
  tenantId: string;
  studentId: string;
  actorUserId: string;
  name?: string;
  email?: string;
}

/// Edita nome e/ou e-mail de um aluno do próprio tenant.
///
/// Regra de e-mail (FIT-014): uma vez que o aluno já tem `userId` (conta
/// ativada — FIT-015), o e-mail de autenticação nunca é alterado
/// silenciosamente por aqui — não existe, nesta arquitetura, um fluxo
/// seguro de troca de e-mail pós-ativação (verificação, confirmação), então
/// a alteração é bloqueada com uma mensagem clara em vez de ser aplicada.
/// Antes da ativação (`userId` nulo), o e-mail pode ser editado livremente,
/// sujeito às mesmas duas verificações de duplicidade do cadastro
/// (`createStudent`). Não há convite pendente a invalidar nesta História —
/// o modelo de convite é escopo da FIT-015; quando existir, invalidá-lo ao
/// trocar o e-mail pré-ativação é responsabilidade daquela História.
export async function updateStudent(input: UpdateStudentInput, client: PrismaClient = prisma): Promise<Student> {
  const current = await getStudentForTenant({ tenantId: input.tenantId, studentId: input.studentId }, client);
  if (!current) {
    throw new StudentError("NAO_ENCONTRADO", "Aluno não encontrado.");
  }

  const data: { displayName?: string; email?: string } = {};

  if (input.name !== undefined) {
    const name = normalizeName(input.name);
    if (name.length === 0) {
      throw new StudentError("VALIDACAO", "Informe o nome do aluno.");
    }
    data.displayName = name;
  }

  if (input.email !== undefined) {
    const email = normalizeEmail(input.email);
    if (!EMAIL_PATTERN.test(email)) {
      throw new StudentError("VALIDACAO", "Informe um e-mail válido.");
    }

    if (email !== current.email) {
      if (current.userId) {
        throw new StudentError(
          "EMAIL_BLOQUEADO_POS_ATIVACAO",
          "Este aluno já ativou a conta — o e-mail de autenticação não pode ser alterado por aqui."
        );
      }

      const existingAccount = await client.user.findUnique({ where: { email } });
      if (existingAccount) {
        throw new StudentError("EMAIL_JA_POSSUI_CONTA", "Este e-mail já possui uma conta no FitOS.");
      }

      data.email = email;
    }
  }

  if (Object.keys(data).length === 0) {
    return current;
  }

  try {
    const [, updated] = await client.$transaction([
      client.auditEvent.create({
        data: {
          tenantId: input.tenantId,
          actorUserId: input.actorUserId,
          action: "ALUNO_EDITADO",
          entityType: "Student",
          entityId: input.studentId,
        },
      }),
      client.student.update({ where: { id: input.studentId }, data }),
    ]);
    return updated;
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      throw new StudentError("EMAIL_DUPLICADO_NO_TENANT", "Já existe um aluno com este e-mail na sua carteira.");
    }
    throw error;
  }
}

export interface StudentLifecycleInput {
  tenantId: string;
  studentId: string;
  actorUserId: string;
}

/// Inativa um aluno do próprio tenant. Idempotente: chamar novamente sobre
/// um aluno já inativo não é um erro — apenas retorna o aluno sem
/// alteração nem novo evento de auditoria (ação repetida não deve produzir
/// ruído). Não há convite pendente a cancelar nesta História (modelo de
/// convite é escopo da FIT-015). Preserva o histórico — nunca exclusão
/// física.
export async function inactivateStudent(input: StudentLifecycleInput, client: PrismaClient = prisma): Promise<Student> {
  const current = await getStudentForTenant({ tenantId: input.tenantId, studentId: input.studentId }, client);
  if (!current) {
    throw new StudentError("NAO_ENCONTRADO", "Aluno não encontrado.");
  }
  if (current.status === "INATIVO") {
    return current;
  }

  const [, updated] = await client.$transaction([
    client.auditEvent.create({
      data: {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        action: "ALUNO_INATIVADO",
        entityType: "Student",
        entityId: input.studentId,
      },
    }),
    client.student.update({ where: { id: input.studentId }, data: { status: "INATIVO" } }),
  ]);
  return updated;
}

/// Reativa um aluno do próprio tenant. Idempotente pela mesma razão de
/// `inactivateStudent`. Não restaura nenhum convite expirado ou cancelado
/// automaticamente (não há convites nesta História).
export async function reactivateStudent(input: StudentLifecycleInput, client: PrismaClient = prisma): Promise<Student> {
  const current = await getStudentForTenant({ tenantId: input.tenantId, studentId: input.studentId }, client);
  if (!current) {
    throw new StudentError("NAO_ENCONTRADO", "Aluno não encontrado.");
  }
  if (current.status === "ATIVO") {
    return current;
  }

  const [, updated] = await client.$transaction([
    client.auditEvent.create({
      data: {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        action: "ALUNO_REATIVADO",
        entityType: "Student",
        entityId: input.studentId,
      },
    }),
    client.student.update({ where: { id: input.studentId }, data: { status: "ATIVO" } }),
  ]);
  return updated;
}
