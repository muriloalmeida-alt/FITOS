import "server-only";
import { Prisma, type CrmProspectStatus, type PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { AdminError } from "@/modules/admin/users";
import { setCouponStatus } from "@/modules/billing/coupons";
import { createAutoCoupon, livreMonthlyPlanIds, randomCode } from "@/modules/billing/autoCoupons";
import { quoteCoupon, redeemCoupon } from "@/modules/billing/couponRedemptions";
import { describeError, logEvent } from "@/shared/lib/serverLog";
import { CrmInputError, parseBulk, parseProspect, type ProspectInput } from "@/shared/lib/crm";

/// CRM de convites (admin): futuros clientes do FitOS Livre. Cada contato
/// ganha um cupom próprio, criado e ativado aqui: 50% no primeiro mês
/// (além do teste grátis), uso único, só conta nova do Livre. O link do
/// convite marca a abertura; o cadastro por ele aplica o cupom.

const COUPON_PERCENT_BPS = 5000;
const TOKEN_ALPHABET = "abcdefghijkmnopqrstuvwxyz23456789";

function inputError(error: unknown): never {
  if (error instanceof CrmInputError) throw new AdminError("VALIDACAO", error.message);
  throw error;
}

const createProspectCoupon = (actorId: string, name: string, planIds: string[], client: PrismaClient) =>
  createAutoCoupon(actorId, { prefix: "CONHECA", name: `CRM · ${name}`, percentBps: COUPON_PERCENT_BPS, planIds, note: "Convite do CRM: 50% no primeiro mês depois do teste grátis." }, client);

async function createOne(actorId: string, input: ProspectInput, planIds: string[], client: PrismaClient) {
  if (await client.crmProspect.findUnique({ where: { phone: input.phone }, select: { id: true } })) {
    throw new AdminError("CONFLITO", "Este celular já está no CRM.");
  }
  const coupon = await createProspectCoupon(actorId, input.name, planIds, client);
  try {
    return await client.crmProspect.create({ data: { name: input.name, phone: input.phone, email: input.email, note: input.note, token: randomCode(TOKEN_ALPHABET, 12), couponId: coupon.id, createdById: actorId } });
  } catch (error) {
    // Mesmo celular cadastrado em paralelo: o cupom criado agora não serve a ninguém.
    await setCouponStatus(actorId, coupon.id, "ENCERRAR", client).catch(() => undefined);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new AdminError("CONFLITO", "Este celular já está no CRM.");
    throw error;
  }
}

export async function createProspect(actorId: string, raw: { name?: unknown; phone?: unknown; email?: unknown; note?: unknown }, client: PrismaClient = prisma) {
  let input: ProspectInput;
  try {
    input = parseProspect(raw);
  } catch (error) {
    inputError(error);
  }
  return createOne(actorId, input, await livreMonthlyPlanIds(client), client);
}

export interface BulkResult {
  created: number;
  duplicates: { line: number; name: string }[];
  errors: { line: number; text: string; message: string }[];
}

/// Importação em lote: cada linha válida vira um contato com cupom; celular
/// já no CRM é pulado e informado; linhas inválidas voltam com o motivo.
export async function importProspects(actorId: string, text: unknown, client: PrismaClient = prisma): Promise<BulkResult> {
  if (typeof text !== "string" || !text.trim()) throw new AdminError("VALIDACAO", "Cole a lista ou escolha um arquivo.");
  let parsed;
  try {
    parsed = parseBulk(text);
  } catch (error) {
    inputError(error);
  }
  const result: BulkResult = { created: 0, duplicates: [], errors: parsed.errors };
  if (parsed.valid.length === 0) return result;
  const planIds = await livreMonthlyPlanIds(client);
  const existing = new Set((await client.crmProspect.findMany({ where: { phone: { in: parsed.valid.map((entry) => entry.phone) } }, select: { phone: true } })).map((row) => row.phone));
  for (const entry of parsed.valid) {
    if (existing.has(entry.phone)) {
      result.duplicates.push({ line: entry.line, name: entry.name });
      continue;
    }
    try {
      await createOne(actorId, entry, planIds, client);
      result.created += 1;
    } catch (error) {
      if (error instanceof AdminError && error.kind === "CONFLITO" && /já está no CRM/.test(error.message)) result.duplicates.push({ line: entry.line, name: entry.name });
      else {
        logEvent("error", "crm_import_failed", { line: entry.line, ...describeError(error) });
        result.errors.push({ line: entry.line, text: entry.name, message: error instanceof AdminError ? error.message : "Não foi possível cadastrar este contato." });
      }
    }
  }
  return result;
}

export interface ProspectRow {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  note: string | null;
  status: CrmProspectStatus;
  token: string;
  couponCode: string;
  inviteCount: number;
  invitedAt: Date | null;
  openedAt: Date | null;
  signedUpAt: Date | null;
  createdAt: Date;
}

export async function listProspects(input: { status?: CrmProspectStatus | null; query?: string } = {}, client: PrismaClient = prisma): Promise<{ rows: ProspectRow[]; counts: Record<CrmProspectStatus, number> }> {
  const query = input.query?.trim();
  const digits = query?.replace(/\D/g, "");
  const where: Prisma.CrmProspectWhereInput = {
    ...(input.status ? { status: input.status } : {}),
    ...(query ? { OR: [{ name: { contains: query, mode: "insensitive" } }, ...(digits && digits.length >= 4 ? [{ phone: { contains: digits } }] : [])] } : {}),
  };
  const [rows, grouped] = await Promise.all([
    client.crmProspect.findMany({ where, orderBy: [{ createdAt: "desc" }], take: 300, include: { coupon: { select: { code: true } } } }),
    client.crmProspect.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const counts = { NOVO: 0, CONVIDADO: 0, ABERTO: 0, CADASTRADO: 0, DESCARTADO: 0 } as Record<CrmProspectStatus, number>;
  for (const group of grouped) counts[group.status] = group._count._all;
  return {
    counts,
    rows: rows.map(({ coupon, couponId: _couponId, createdById: _createdById, tenantId: _tenantId, updatedAt: _updatedAt, ...row }) => ({ ...row, couponCode: coupon.code })),
  };
}

/// O admin tocou em "Enviar pelo WhatsApp". Não muda quem já abriu ou se
/// cadastrou; só conta o envio.
export async function markInvited(id: string, client: PrismaClient = prisma, now = new Date()): Promise<void> {
  const prospect = await client.crmProspect.findUnique({ where: { id }, select: { status: true } });
  if (!prospect) throw new AdminError("NAO_ENCONTRADO", "Contato não encontrado.");
  if (prospect.status === "DESCARTADO") throw new AdminError("CONFLITO", "Contato descartado.");
  await client.crmProspect.update({
    where: { id },
    data: { inviteCount: { increment: 1 }, invitedAt: now, ...(prospect.status === "NOVO" ? { status: "CONVIDADO" } : {}) },
  });
}

/// Descartar encerra o cupom do contato (ninguém mais usa o código).
export async function discardProspect(actorId: string, id: string, client: PrismaClient = prisma): Promise<void> {
  const prospect = await client.crmProspect.findUnique({ where: { id }, select: { status: true, couponId: true } });
  if (!prospect) throw new AdminError("NAO_ENCONTRADO", "Contato não encontrado.");
  if (prospect.status === "CADASTRADO") throw new AdminError("CONFLITO", "Este contato já se cadastrou.");
  if (prospect.status === "DESCARTADO") return;
  await client.crmProspect.update({ where: { id }, data: { status: "DESCARTADO" } });
  await setCouponStatus(actorId, prospect.couponId, "ENCERRAR", client).catch(() => undefined);
}

/// Link aberto: registra a primeira abertura. Devolve o convite válido
/// (ou `null`: token desconhecido, descartado ou já usado no cadastro).
export async function openInvite(token: unknown, client: PrismaClient = prisma, now = new Date()): Promise<{ token: string; couponCode: string; name: string } | null> {
  if (typeof token !== "string" || !/^[a-z0-9]{8,32}$/.test(token)) return null;
  const prospect = await client.crmProspect.findUnique({ where: { token }, include: { coupon: { select: { code: true } } } });
  if (!prospect || prospect.status === "DESCARTADO" || prospect.status === "CADASTRADO") return null;
  if (!prospect.openedAt) {
    await client.crmProspect.update({ where: { id: prospect.id }, data: { openedAt: now, status: "ABERTO" } });
  }
  return { token, couponCode: prospect.coupon.code, name: prospect.name };
}

/// Convite válido para mostrar no cadastro (sem registrar nada).
export async function peekInvite(token: unknown, client: PrismaClient = prisma): Promise<{ couponCode: string } | null> {
  if (typeof token !== "string" || !/^[a-z0-9]{8,32}$/.test(token)) return null;
  const prospect = await client.crmProspect.findUnique({ where: { token }, include: { coupon: { select: { code: true } } } });
  if (!prospect || prospect.status === "DESCARTADO" || prospect.status === "CADASTRADO") return null;
  return { couponCode: prospect.coupon.code };
}

/// Cadastro do Livre feito pelo link: marca o contato e aplica o cupom
/// dele na conta nova (resgate idempotente por contato). Nunca derruba o
/// cadastro: falha no cupom fica no log e o contato continua marcado.
export async function claimInvite(input: { token: unknown; tenantId: string; userId: string }, client: PrismaClient = prisma, now = new Date()): Promise<{ claimed: boolean; couponApplied: boolean }> {
  if (typeof input.token !== "string") return { claimed: false, couponApplied: false };
  const prospect = await client.crmProspect.findUnique({ where: { token: input.token }, include: { coupon: { select: { code: true } } } });
  if (!prospect || prospect.status === "DESCARTADO" || (prospect.tenantId && prospect.tenantId !== input.tenantId)) return { claimed: false, couponApplied: false };
  const tenant = await client.tenant.findUnique({ where: { id: input.tenantId }, select: { type: true } });
  if (tenant?.type !== "INDIVIDUAL") return { claimed: false, couponApplied: false };
  try {
    await client.crmProspect.update({ where: { id: prospect.id }, data: { status: "CADASTRADO", signedUpAt: prospect.signedUpAt ?? now, tenantId: input.tenantId, openedAt: prospect.openedAt ?? now } });
  } catch (error) {
    // A conta já está ligada a outro convite: este fica como estava.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { claimed: false, couponApplied: false };
    throw error;
  }
  try {
    const quote = await quoteCoupon({ tenantId: input.tenantId }, prospect.coupon.code, client, now);
    await redeemCoupon({ tenantId: input.tenantId, actorUserId: input.userId, code: prospect.coupon.code, operationKey: `crm-${prospect.id}`, revision: quote.revision }, client, now);
    return { claimed: true, couponApplied: true };
  } catch (error) {
    if ((error as { kind?: string }).kind === "ALREADY_USED") return { claimed: true, couponApplied: true };
    logEvent("warn", "crm_coupon_not_applied", { prospectId: prospect.id, tenantId: input.tenantId, ...describeError(error) });
    return { claimed: true, couponApplied: false };
  }
}
