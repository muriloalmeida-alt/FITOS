import "server-only";
import { Prisma, type CommercialPlan, type PlanBillingCycle, type PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";

/// Catálogo de planos comerciais da assinatura SaaS (FIT-090, EPIC-12).
/// Nenhum preço/limite fica hardcoded em código de aplicação — tudo vem de
/// `CommercialPlan`. Nenhuma função deste módulo aceita `tenantId`: plano
/// comercial não pertence a nenhum tenant, é o mesmo catálogo para todos.
///
/// Versionamento por publicação, nunca por edição: `publishPlanVersion` é a
/// única forma de escrita — sempre cria uma linha nova, nunca faz `update`
/// em `priceCents`/`studentLimit`/`trialDays`/`discountPercent` de uma
/// versão já existente. Isso preserva as condições de qualquer assinatura
/// que já referencie uma versão (FIT-092), mesmo depois de uma republicação.

export class PlanError extends Error {
  constructor(
    public readonly kind: "VALIDACAO" | "NAO_ENCONTRADO" | "PUBLICACAO_CONCORRENTE",
    message: string
  ) {
    super(message);
    this.name = "PlanError";
  }
}

const MAX_CODE_LENGTH = 40;
const MAX_NAME_LENGTH = 80;
const SUPPORTED_CURRENCY = "BRL";

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function normalizeCode(code: string): string {
  const trimmed = code.trim().toLowerCase();
  if (trimmed.length === 0 || trimmed.length > MAX_CODE_LENGTH) {
    throw new PlanError("VALIDACAO", `Informe um código de plano com até ${MAX_CODE_LENGTH} caracteres.`);
  }
  return trimmed;
}

function normalizeName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_NAME_LENGTH) {
    throw new PlanError("VALIDACAO", `Informe um nome de plano com até ${MAX_NAME_LENGTH} caracteres.`);
  }
  return trimmed;
}

export interface PublishPlanVersionInput {
  code: string;
  name: string;
  billingCycle: PlanBillingCycle;
  priceCents: number;
  studentLimit: number;
  trialDays?: number;
  discountPercent?: number;
}

function validatePublishInput(input: PublishPlanVersionInput): void {
  if (!Number.isInteger(input.priceCents) || input.priceCents <= 0) {
    throw new PlanError("VALIDACAO", "priceCents deve ser um inteiro positivo (centavos).");
  }
  if (!Number.isInteger(input.studentLimit) || input.studentLimit <= 0) {
    throw new PlanError("VALIDACAO", "studentLimit deve ser um inteiro positivo.");
  }
  if (input.trialDays !== undefined && (!Number.isInteger(input.trialDays) || input.trialDays < 0)) {
    throw new PlanError("VALIDACAO", "trialDays deve ser um inteiro maior ou igual a zero.");
  }
  if (
    input.discountPercent !== undefined &&
    (!Number.isInteger(input.discountPercent) || input.discountPercent < 0 || input.discountPercent > 100)
  ) {
    throw new PlanError("VALIDACAO", "discountPercent deve ser um inteiro entre 0 e 100.");
  }
}

/// Publica uma nova versão vendável de `(code, billingCycle)`: desativa a
/// versão ativa anterior (se houver, `active: false` + `effectiveTo: now`)
/// e cria uma linha nova com `version` incrementado. Nunca edita a versão
/// anterior além desses dois campos — preço/limite/trial/desconto daquela
/// linha permanecem exatamente como foram vendidos.
///
/// O índice único parcial da migration (`WHERE active = true`) é a garantia
/// real contra duas publicações concorrentes para o mesmo `(code,
/// billingCycle)`; a checagem em código abaixo só existe para a mensagem de
/// erro amigável, mesmo padrão já usado em `catalogImportRun.ts`.
export async function publishPlanVersion(
  input: PublishPlanVersionInput,
  client: PrismaClient = prisma
): Promise<CommercialPlan> {
  validatePublishInput(input);
  const code = normalizeCode(input.code);
  const name = normalizeName(input.name);

  try {
    return await client.$transaction(async (tx) => {
      const currentActive = await tx.commercialPlan.findFirst({
        where: { code, billingCycle: input.billingCycle, active: true },
      });

      if (currentActive) {
        await tx.commercialPlan.update({
          where: { id: currentActive.id },
          data: { active: false, effectiveTo: new Date() },
        });
      }

      return tx.commercialPlan.create({
        data: {
          code,
          name,
          billingCycle: input.billingCycle,
          priceCents: input.priceCents,
          currency: SUPPORTED_CURRENCY,
          studentLimit: input.studentLimit,
          trialDays: input.trialDays ?? 0,
          discountPercent: input.discountPercent,
          version: (currentActive?.version ?? 0) + 1,
          active: true,
        },
      });
    });
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      throw new PlanError(
        "PUBLICACAO_CONCORRENTE",
        `Já existe uma publicação concorrente para "${code}" (${input.billingCycle}). Tente novamente.`
      );
    }
    throw error;
  }
}

/// Catálogo vendável — só versões `active: true`. "Plano inativo não é
/// vendável" nunca depende só deste filtro (garantia física no índice), mas
/// é aqui que a regra vira comportamento visível para quem consome o
/// catálogo (futuro checkout, FIT-092).
export async function listSellablePlans(client: PrismaClient = prisma): Promise<CommercialPlan[]> {
  return client.commercialPlan.findMany({
    where: { active: true },
    orderBy: [{ code: "asc" }, { billingCycle: "asc" }],
  });
}

export async function getSellablePlan(
  code: string,
  billingCycle: PlanBillingCycle,
  client: PrismaClient = prisma
): Promise<CommercialPlan | null> {
  return client.commercialPlan.findFirst({
    where: { code: normalizeCode(code), billingCycle, active: true },
  });
}

/// Resolve qualquer versão pelo id, ativa ou não — uso futuro (FIT-092) para
/// exibir os termos exatos de uma assinatura já contratada, mesmo depois de
/// uma republicação do plano.
export async function getPlanVersionById(id: string, client: PrismaClient = prisma): Promise<CommercialPlan | null> {
  return client.commercialPlan.findUnique({ where: { id } });
}
