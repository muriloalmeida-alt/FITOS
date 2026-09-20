import "server-only";
import { type StudentCharge, type ChargeRecurrence, type PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { getStudentForTenant } from "@/modules/students/students";

/// Cobrança e pagamento manual do aluno (FIT-050/FIT-051). `status` é
/// sempre um dos quatro estados persistidos `pendente`/`pago`/`atrasado`/
/// `cancelado` (regra registrada desde a FIT-007 no README deste módulo)
/// — "a vencer" nunca é escrito, é sempre apresentação calculada sobre
/// `pendente` com `dueDate` futuro (ver `getDisplayChargeState` na UI).
///
/// A transição `pendente` → `atrasado` não depende de nenhum job em
/// segundo plano (mesma decisão de não construir infraestrutura de
/// agendamento especulativa já tomada na FIT-020/023): `refreshOverdueCharges`
/// é chamada de forma auto-contida no início de toda leitura agregada
/// (listagem, resumo) e simplesmente não faz nada quando não há nada
/// vencido — idempotente, sem efeito colateral visível para quem lê.

export class StudentChargeError extends Error {
  constructor(
    public readonly kind: "VALIDACAO" | "NAO_ENCONTRADO" | "ESTADO_INVALIDO",
    message: string
  ) {
    super(message);
    this.name = "StudentChargeError";
  }
}

const MAX_DESCRIPTION_LENGTH = 200;
const MAX_CANCEL_REASON_LENGTH = 300;

function normalizeDescription(description: string): string {
  const trimmed = description.trim();
  if (trimmed.length === 0) {
    throw new StudentChargeError("VALIDACAO", "A descrição é obrigatória.");
  }
  if (trimmed.length > MAX_DESCRIPTION_LENGTH) {
    throw new StudentChargeError("VALIDACAO", `A descrição deve ter no máximo ${MAX_DESCRIPTION_LENGTH} caracteres.`);
  }
  return trimmed;
}

/// Valores monetários nunca em ponto flutuante binário (`REGRAS-DE-NEGOCIO.md`
/// seção 8) — o valor chega em reais (número decimal, o que o formulário
/// exibe) e é convertido para centavos (Int) uma única vez, aqui.
export function centsFromReais(valueReais: number): number {
  if (!Number.isFinite(valueReais) || valueReais <= 0) {
    throw new StudentChargeError("VALIDACAO", "O valor deve ser maior que zero.");
  }
  return Math.round(valueReais * 100);
}

function assertValidDate(date: Date, fieldLabel: string): void {
  if (Number.isNaN(date.getTime())) {
    throw new StudentChargeError("VALIDACAO", `${fieldLabel} inválida.`);
  }
}

function firstDayOfMonthUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function normalizeCancelReason(reason: string): string {
  const trimmed = reason.trim();
  if (trimmed.length === 0) {
    throw new StudentChargeError("VALIDACAO", "O motivo do cancelamento é obrigatório.");
  }
  if (trimmed.length > MAX_CANCEL_REASON_LENGTH) {
    throw new StudentChargeError("VALIDACAO", `O motivo deve ter no máximo ${MAX_CANCEL_REASON_LENGTH} caracteres.`);
  }
  return trimmed;
}

export interface CreateStudentChargeInput {
  tenantId: string;
  studentId: string;
  description: string;
  amountReais: number;
  referenceMonth: Date;
  dueDate: Date;
}

/// Cadastra uma cobrança — sempre inicia `pendente` (nenhum cenário do
/// backlog/MVP produz outro estado inicial). Isolamento: `studentId`
/// precisa pertencer ao `tenantId` da sessão (`NAO_ENCONTRADO` caso
/// contrário, mesmo padrão do restante da aplicação).
export async function createStudentCharge(
  input: CreateStudentChargeInput,
  client: PrismaClient = prisma
): Promise<StudentCharge> {
  const student = await getStudentForTenant({ tenantId: input.tenantId, studentId: input.studentId }, client);
  if (!student) {
    throw new StudentChargeError("NAO_ENCONTRADO", "Aluno não encontrado.");
  }

  const description = normalizeDescription(input.description);
  const amountCents = centsFromReais(input.amountReais);
  assertValidDate(input.referenceMonth, "Competência");
  assertValidDate(input.dueDate, "Vencimento");

  return client.studentCharge.create({
    data: {
      tenantId: input.tenantId,
      studentId: input.studentId,
      description,
      amountCents,
      referenceMonth: firstDayOfMonthUtc(input.referenceMonth),
      dueDate: input.dueDate,
    },
  });
}

/// Aplica a transição `pendente` → `atrasado` para cobranças cujo
/// vencimento já passou (comparado ao início do dia de hoje — uma cobrança
/// que vence hoje ainda não é atrasada). Sempre escopada por tenant — nunca
/// uma atualização global entre tenants, mesmo sendo apenas uma mudança de
/// status. Chamar isto não é opcional antes de qualquer leitura agregada.
export async function refreshOverdueCharges(input: { tenantId: string }, client: PrismaClient = prisma): Promise<void> {
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);
  await client.studentCharge.updateMany({
    where: { tenantId: input.tenantId, status: "PENDENTE", dueDate: { lt: startOfToday } },
    data: { status: "ATRASADO" },
  });
}

export type StudentChargeWithPayment = StudentCharge & {
  payment: { id: string; amountCentsPaid: number; paidAt: Date; method: string } | null;
};

const CHARGE_WITH_PAYMENT_INCLUDE = {
  payment: { select: { id: true as const, amountCentsPaid: true as const, paidAt: true as const, method: true as const } },
};

/// Histórico de cobranças do aluno (competência mais recente primeiro) —
/// usado pela ficha do aluno e pela tela de financeiro.
export async function listChargesForStudent(
  input: { tenantId: string; studentId: string },
  client: PrismaClient = prisma
): Promise<StudentChargeWithPayment[]> {
  await refreshOverdueCharges({ tenantId: input.tenantId }, client);
  return client.studentCharge.findMany({
    where: { tenantId: input.tenantId, studentId: input.studentId },
    orderBy: { referenceMonth: "desc" },
    include: CHARGE_WITH_PAYMENT_INCLUDE,
  });
}

export type StudentChargeWithStudentAndPayment = StudentChargeWithPayment & {
  student: { id: string; displayName: string };
};

/// Todas as cobranças do tenant (não só de um aluno) — base da tela
/// "Financeiro" (FIT-050/053): nenhuma História pede uma listagem
/// separada por aluno nesta tela, e a visão consolidada é o que o design
/// (`CRITICAL-SCREEN-SPECS.md` seção 7 — "Lista de recebimentos") pede.
export async function listChargesForTenant(
  input: { tenantId: string; referenceMonth?: Date },
  client: PrismaClient = prisma
): Promise<StudentChargeWithStudentAndPayment[]> {
  await refreshOverdueCharges({ tenantId: input.tenantId }, client);
  return client.studentCharge.findMany({
    where: { tenantId: input.tenantId, ...(input.referenceMonth ? { referenceMonth: input.referenceMonth } : {}) },
    orderBy: { referenceMonth: "desc" },
    include: { ...CHARGE_WITH_PAYMENT_INCLUDE, student: { select: { id: true, displayName: true } } },
  });
}

export interface FinancialSummary {
  previstoCents: number;
  recebidoCents: number;
  pendenteCents: number;
  atrasadoCents: number;
}

/// Resumo financeiro da competência (FIT-053): previsto (soma de tudo
/// não cancelado), recebido (soma dos pagamentos), pendente e atrasado.
/// "Atrasado" é sempre coerente com o vencimento no momento da consulta
/// — `refreshOverdueCharges` roda antes de qualquer soma.
export async function getFinancialSummary(
  input: { tenantId: string; referenceMonth: Date },
  client: PrismaClient = prisma
): Promise<FinancialSummary> {
  await refreshOverdueCharges({ tenantId: input.tenantId }, client);
  const charges = await client.studentCharge.findMany({
    where: { tenantId: input.tenantId, referenceMonth: input.referenceMonth },
    include: { payment: { select: { amountCentsPaid: true } } },
  });

  const summary: FinancialSummary = { previstoCents: 0, recebidoCents: 0, pendenteCents: 0, atrasadoCents: 0 };
  for (const charge of charges) {
    if (charge.status === "CANCELADO") {
      continue;
    }
    summary.previstoCents += charge.amountCents;
    if (charge.status === "PAGO" && charge.payment) {
      summary.recebidoCents += charge.payment.amountCentsPaid;
    } else if (charge.status === "PENDENTE") {
      summary.pendenteCents += charge.amountCents;
    } else if (charge.status === "ATRASADO") {
      summary.atrasadoCents += charge.amountCents;
    }
  }
  return summary;
}

/// Cancela uma cobrança — exige motivo, nunca equivale a pagamento
/// (`REGRAS-DE-NEGOCIO.md` seção 8). Idempotente para uma já cancelada;
/// uma cobrança já paga nunca pode ser cancelada por esta via (o motivo
/// de reverter um pagamento é um cenário de estorno, fora do MVP).
export async function cancelStudentCharge(
  input: { tenantId: string; chargeId: string; reason: string },
  client: PrismaClient = prisma
): Promise<StudentCharge> {
  const charge = await client.studentCharge.findFirst({ where: { id: input.chargeId, tenantId: input.tenantId } });
  if (!charge) {
    throw new StudentChargeError("NAO_ENCONTRADO", "Cobrança não encontrada.");
  }
  if (charge.status === "CANCELADO") {
    return charge;
  }
  if (charge.status === "PAGO") {
    throw new StudentChargeError("ESTADO_INVALIDO", "Uma cobrança já paga não pode ser cancelada.");
  }

  const reason = normalizeCancelReason(input.reason);
  return client.studentCharge.update({
    where: { id: charge.id },
    data: { status: "CANCELADO", cancelReason: reason, cancelledAt: new Date() },
  });
}

const MAX_METHOD_LENGTH = 60;

function normalizeMethod(method: string): string {
  const trimmed = method.trim();
  if (trimmed.length === 0) {
    throw new StudentChargeError("VALIDACAO", "A forma de pagamento é obrigatória.");
  }
  if (trimmed.length > MAX_METHOD_LENGTH) {
    throw new StudentChargeError("VALIDACAO", `A forma de pagamento deve ter no máximo ${MAX_METHOD_LENGTH} caracteres.`);
  }
  return trimmed;
}

export interface RegisterPaymentInput {
  tenantId: string;
  actorUserId: string;
  chargeId: string;
  amountReceivedReais: number;
  paidAt: Date;
  method: string;
}

/// Registra o pagamento de uma cobrança (FIT-051) — data e valor recebido
/// são obrigatórios (`REGRAS-DE-NEGOCIO.md` seção 8). Pagamento parcial
/// fica fora do MVP: o valor recebido é só histórico (`Payment`, entidade
/// própria — nunca campos em `StudentCharge`), sem reconciliação de saldo
/// restante — a cobrança sempre passa a `pago` num único pagamento, nunca
/// "parcialmente paga". Registra `AuditEvent` (seção 9 lista "pagamento"
/// explicitamente, ao contrário de `WorkoutSession`/FIT-041). Defesa física
/// contra dois pagamentos para a mesma cobrança: `payments.studentChargeId`
/// é `@unique` — mesmo padrão de `WorkoutSessionResult` (FIT-041).
export async function registerPayment(input: RegisterPaymentInput, client: PrismaClient = prisma): Promise<StudentCharge> {
  const charge = await client.studentCharge.findFirst({ where: { id: input.chargeId, tenantId: input.tenantId } });
  if (!charge) {
    throw new StudentChargeError("NAO_ENCONTRADO", "Cobrança não encontrada.");
  }
  if (charge.status === "PAGO") {
    throw new StudentChargeError("ESTADO_INVALIDO", "Esta cobrança já está paga.");
  }
  if (charge.status === "CANCELADO") {
    throw new StudentChargeError("ESTADO_INVALIDO", "Uma cobrança cancelada não pode ser paga.");
  }

  const amountCentsPaid = centsFromReais(input.amountReceivedReais);
  assertValidDate(input.paidAt, "Data do pagamento");
  const method = normalizeMethod(input.method);

  return client.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        tenantId: input.tenantId,
        studentChargeId: charge.id,
        amountCentsPaid,
        paidAt: input.paidAt,
        method,
        recordedByUserId: input.actorUserId,
      },
    });

    const updated = await tx.studentCharge.update({ where: { id: charge.id }, data: { status: "PAGO" } });

    await tx.auditEvent.create({
      data: {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        action: "PAGAMENTO_REGISTRADO",
        entityType: "StudentCharge",
        entityId: charge.id,
      },
    });

    return updated;
  });
}

const MAX_DUE_DAY_OF_MONTH = 28;

/// `dueDayOfMonth` limitado a 1-28 (nunca 29/30/31): assim todo mês tem
/// esse dia por construção, sem nenhuma regra de "cair no dia mais próximo"
/// que nenhum documento pediu — mais simples e sempre correto.
function normalizeDueDayOfMonth(dueDayOfMonth: number): number {
  if (!Number.isInteger(dueDayOfMonth) || dueDayOfMonth < 1 || dueDayOfMonth > MAX_DUE_DAY_OF_MONTH) {
    throw new StudentChargeError("VALIDACAO", `O dia de vencimento deve ser um número inteiro entre 1 e ${MAX_DUE_DAY_OF_MONTH}.`);
  }
  return dueDayOfMonth;
}

function dueDateForReferenceMonth(referenceMonth: Date, dueDayOfMonth: number): Date {
  return new Date(Date.UTC(referenceMonth.getUTCFullYear(), referenceMonth.getUTCMonth(), dueDayOfMonth));
}

export interface CreateChargeRecurrenceInput {
  tenantId: string;
  studentId: string;
  description: string;
  amountReais: number;
  dueDayOfMonth: number;
}

/// Cria a definição da recorrência (FIT-052) — ainda não gera nenhum
/// `StudentCharge`; a primeira geração é sempre uma ação explícita
/// separada (`generateNextChargeForRecurrence`).
export async function createChargeRecurrence(
  input: CreateChargeRecurrenceInput,
  client: PrismaClient = prisma
): Promise<ChargeRecurrence> {
  const student = await getStudentForTenant({ tenantId: input.tenantId, studentId: input.studentId }, client);
  if (!student) {
    throw new StudentChargeError("NAO_ENCONTRADO", "Aluno não encontrado.");
  }

  const description = normalizeDescription(input.description);
  const amountCents = centsFromReais(input.amountReais);
  const dueDayOfMonth = normalizeDueDayOfMonth(input.dueDayOfMonth);

  return client.chargeRecurrence.create({
    data: { tenantId: input.tenantId, studentId: input.studentId, description, amountCents, dueDayOfMonth },
  });
}

/// Recorrências ativas do tenant — base da UI de "cobranças recorrentes".
export async function listActiveRecurrencesForTenant(
  input: { tenantId: string },
  client: PrismaClient = prisma
): Promise<(ChargeRecurrence & { student: { id: string; displayName: string } })[]> {
  return client.chargeRecurrence.findMany({
    where: { tenantId: input.tenantId, status: "ATIVA" },
    orderBy: { createdAt: "desc" },
    include: { student: { select: { id: true, displayName: true } } },
  });
}

/// Gera o próximo lançamento independente da recorrência (FIT-052) — "a
/// cobrança recorrente gera lançamentos independentes por competência"
/// (`REGRAS-DE-NEGOCIO.md` seção 8): o `StudentCharge` criado aqui é uma
/// cópia física dos valores atuais da recorrência, nunca uma referência
/// viva — alterar a recorrência depois nunca muda este lançamento.
/// Competência: a primeira nunca gerada ainda (mês da criação, se nenhuma
/// foi gerada; senão, o mês seguinte à mais recente já gerada). Defesa
/// física contra geração duplicada: `student_charges_recurrenceId_referenceMonth_key`
/// — mesmo com essa checagem prévia, a unicidade é a garantia real.
export async function generateNextChargeForRecurrence(
  input: { tenantId: string; recurrenceId: string },
  client: PrismaClient = prisma
): Promise<StudentCharge> {
  const recurrence = await client.chargeRecurrence.findFirst({ where: { id: input.recurrenceId, tenantId: input.tenantId } });
  if (!recurrence) {
    throw new StudentChargeError("NAO_ENCONTRADO", "Recorrência não encontrada.");
  }
  if (recurrence.status === "ENCERRADA") {
    throw new StudentChargeError("ESTADO_INVALIDO", "Uma recorrência encerrada não gera novas cobranças.");
  }

  const lastGenerated = await client.studentCharge.findFirst({
    where: { recurrenceId: recurrence.id },
    orderBy: { referenceMonth: "desc" },
  });

  const now = new Date();
  const referenceMonth = lastGenerated
    ? new Date(Date.UTC(lastGenerated.referenceMonth.getUTCFullYear(), lastGenerated.referenceMonth.getUTCMonth() + 1, 1))
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  return client.studentCharge.create({
    data: {
      tenantId: recurrence.tenantId,
      studentId: recurrence.studentId,
      description: recurrence.description,
      amountCents: recurrence.amountCents,
      referenceMonth,
      dueDate: dueDateForReferenceMonth(referenceMonth, recurrence.dueDayOfMonth),
      recurrenceId: recurrence.id,
    },
  });
}

/// Encerra a recorrência — nunca uma exclusão física (mesma filosofia de
/// arquivamento do restante da aplicação). Lançamentos já gerados nunca
/// são afetados; idempotente para uma já encerrada.
export async function endChargeRecurrence(
  input: { tenantId: string; recurrenceId: string },
  client: PrismaClient = prisma
): Promise<ChargeRecurrence> {
  const recurrence = await client.chargeRecurrence.findFirst({ where: { id: input.recurrenceId, tenantId: input.tenantId } });
  if (!recurrence) {
    throw new StudentChargeError("NAO_ENCONTRADO", "Recorrência não encontrada.");
  }
  if (recurrence.status === "ENCERRADA") {
    return recurrence;
  }
  return client.chargeRecurrence.update({ where: { id: recurrence.id }, data: { status: "ENCERRADA" } });
}
