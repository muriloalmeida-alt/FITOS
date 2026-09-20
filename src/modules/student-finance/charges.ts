import "server-only";
import { type StudentCharge, type PrismaClient } from "@prisma/client";
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
  input: { tenantId: string },
  client: PrismaClient = prisma
): Promise<StudentChargeWithStudentAndPayment[]> {
  await refreshOverdueCharges({ tenantId: input.tenantId }, client);
  return client.studentCharge.findMany({
    where: { tenantId: input.tenantId },
    orderBy: { referenceMonth: "desc" },
    include: { ...CHARGE_WITH_PAYMENT_INCLUDE, student: { select: { id: true, displayName: true } } },
  });
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
