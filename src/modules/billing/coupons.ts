import "server-only";
import { Prisma, type BillingCycle, type CouponStatus, type PrismaClient, type TenantType } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { AdminError } from "@/modules/admin/users";
import {
  CouponRuleError,
  audienceMatches,
  couponDiscountCents,
  parseCouponConfig,
  type AccountFacts,
  type CouponConfig,
  type CouponConfigInput,
  type CouponCycle,
  type CouponProduct,
  type CouponSegment,
} from "@/shared/lib/coupons";

/// Cupons de desconto (feature 5, ADR-021), lado do administrador: criar,
/// editar, prever, ativar, pausar, encerrar e listar campanhas. Só chamado
/// depois de `requireAdmin()`. As regras de preço e público são as puras
/// de `shared/lib/coupons`; aqui ficam o banco, as versões e a auditoria.

const DAY_MS = 86_400_000;

type Client = PrismaClient | Prisma.TransactionClient;

function ruleError(error: unknown): never {
  if (error instanceof CouponRuleError) throw new AdminError("VALIDACAO", error.message);
  throw error;
}

/// Fatos da conta para o público (ADR-021, decisão 2). Período pago
/// vigente: vencimento da última cobrança paga + um ciclo do plano.
export async function accountFacts(tenantId: string, client: Client = prisma): Promise<AccountFacts | null> {
  const tenant = await client.tenant.findUnique({
    where: { id: tenantId },
    select: { type: true, saasSubscription: { select: { status: true, plan: { select: { billingCycle: true } } } } },
  });
  if (!tenant) return null;
  const lastPaid = await client.saasPayment.findFirst({ where: { tenantId, status: "PAGO" }, orderBy: [{ dueDate: "desc" }, { paidAt: "desc" }], select: { dueDate: true, paidAt: true } });
  const cycleDays = tenant.saasSubscription?.plan.billingCycle === "ANUAL" ? 365 : 30;
  const paidFrom = lastPaid?.dueDate ?? lastPaid?.paidAt ?? null;
  return {
    tenantType: tenant.type,
    subscriptionStatus: tenant.saasSubscription?.status ?? null,
    hasPaidCharge: lastPaid !== null,
    paidAccessUntil: paidFrom ? new Date(paidFrom.getTime() + cycleDays * DAY_MS) : null,
    selected: false,
  };
}

export interface CouponRow {
  id: string;
  code: string;
  name: string;
  status: CouponStatus;
  version: number;
  kind: "PERCENT" | "FIXED_AMOUNT";
  amount: number;
  durationCycles: number;
  products: TenantType[];
  segments: string[];
  cycles: BillingCycle[];
  startsAt: Date | null;
  endsAt: Date | null;
  maxRedemptions: number | null;
  budgetCents: number | null;
  stackable: boolean;
}

const VERSION_SELECT = {
  version: true,
  kind: true,
  amount: true,
  durationCycles: true,
  products: true,
  segments: true,
  planIds: true,
  cycles: true,
  startsAt: true,
  endsAt: true,
  maxRedemptions: true,
  perAccountLimit: true,
  budgetCents: true,
  stackable: true,
  note: true,
} as const;

export async function listCoupons(input: { query?: string; status?: CouponStatus | null } = {}, client: PrismaClient = prisma): Promise<CouponRow[]> {
  const query = input.query?.trim() ?? "";
  const coupons = await client.coupon.findMany({
    where: {
      ...(input.status ? { status: input.status } : { status: { not: "ARCHIVED" } }),
      ...(query ? { OR: [{ code: { contains: query.toUpperCase() } }, { name: { contains: query, mode: "insensitive" } }] } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    include: { currentVersion: { select: VERSION_SELECT } },
  });
  return coupons.flatMap((coupon) => {
    const version = coupon.currentVersion;
    if (!version) return [];
    return [{ id: coupon.id, code: coupon.code, name: coupon.name, status: coupon.status, ...version, version: version.version }];
  });
}

export interface CouponDetail extends CouponRow {
  planIds: string[];
  perAccountLimit: number;
  note: string | null;
  selected: { tenantId: string; name: string; ownerEmail: string }[];
  audit: { operation: string; actorId: string; occurredAt: Date }[];
}

export async function getCoupon(id: string, client: PrismaClient = prisma): Promise<CouponDetail> {
  const coupon = await client.coupon.findUnique({
    where: { id },
    include: {
      currentVersion: { select: { ...VERSION_SELECT, members: { select: { tenant: { select: { id: true, name: true, owner: { select: { email: true } } } } } } } },
      audit: { orderBy: { occurredAt: "desc" }, take: 50, select: { operation: true, actorId: true, occurredAt: true } },
    },
  });
  if (!coupon?.currentVersion) throw new AdminError("NAO_ENCONTRADO", "Cupom não encontrado.");
  const { members, ...version } = coupon.currentVersion;
  return {
    id: coupon.id,
    code: coupon.code,
    name: coupon.name,
    status: coupon.status,
    ...version,
    selected: members.map((member) => ({ tenantId: member.tenant.id, name: member.tenant.name, ownerEmail: member.tenant.owner.email })),
    audit: coupon.audit,
  };
}

export interface CouponPreview {
  plans: { planId: string; name: string; audience: TenantType; billingCycle: BillingCycle; baseCents: number; discountCents: number; finalCents: number }[];
  /// Contas que hoje cairiam no público (estimativa, não promessa).
  audienceCount: number;
  problems: string[];
}

/// Simula o preço de cada plano elegível e conta o público atual.
/// `problems` lista o que impede ativar (plano inexistente, de preço zero,
/// fora do produto ou do ciclo, ou final zero: ciclo sem cobrança fica
/// para depois, ADR-021 decisão 5).
export async function previewCoupon(config: CouponConfig, selectedTenantIds: string[], client: PrismaClient = prisma, now = new Date()): Promise<CouponPreview> {
  const plans = await client.plan.findMany({ where: { id: { in: config.planIds } }, orderBy: [{ audience: "asc" }, { position: "asc" }] });
  const problems: string[] = [];
  if (plans.length !== config.planIds.length) problems.push("Algum plano escolhido não existe mais.");
  const rows = plans.map((plan) => {
    const discountCents = couponDiscountCents(plan.priceCents, config);
    return { planId: plan.id, name: plan.name, audience: plan.audience, billingCycle: plan.billingCycle, baseCents: plan.priceCents, discountCents, finalCents: plan.priceCents - discountCents };
  });
  for (const row of rows) {
    if (row.baseCents <= 0) problems.push(`${row.name}: plano de preço zero não recebe cupom.`);
    else if (row.finalCents <= 0) problems.push(`${row.name}: o desconto zera a cobrança; reduza o valor (ciclo sem cobrança ainda não é suportado).`);
    if (!(config.products as string[]).includes(row.audience)) problems.push(`${row.name}: não é do produto escolhido.`);
    if (!(config.cycles as string[]).includes(row.billingCycle)) problems.push(`${row.name}: o ciclo do plano não está entre os escolhidos.`);
  }
  return { plans: rows, audienceCount: await estimateAudience(config, selectedTenantIds, client, now), problems };
}

async function estimateAudience(config: CouponConfig, selectedTenantIds: string[], client: PrismaClient, now: Date): Promise<number> {
  const selectedOnly = config.segments.includes("SELECIONADOS");
  const tenants = await client.tenant.findMany({
    where: { type: { in: config.products }, ...(selectedOnly ? { id: { in: selectedTenantIds } } : {}) },
    select: { id: true },
  });
  let count = 0;
  for (const tenant of tenants) {
    const facts = await accountFacts(tenant.id, client);
    if (facts && audienceMatches({ products: config.products, segments: config.segments }, { ...facts, selected: selectedOnly }, now)) count++;
  }
  return count;
}

function parse(input: CouponConfigInput): CouponConfig {
  try {
    return parseCouponConfig(input);
  } catch (error) {
    ruleError(error);
  }
}

/// Contas selecionadas: só donos de espaço (personal ou Livre) existentes.
async function resolveSelected(config: CouponConfig, tenantIds: unknown, client: Client): Promise<string[]> {
  if (!config.segments.includes("SELECIONADOS")) return [];
  const ids = Array.isArray(tenantIds) ? [...new Set(tenantIds.filter((id): id is string => typeof id === "string"))] : [];
  if (ids.length === 0) throw new AdminError("VALIDACAO", "Escolha pelo menos uma conta.");
  if (ids.length > 500) throw new AdminError("VALIDACAO", "No máximo 500 contas por campanha.");
  const found = await client.tenant.findMany({ where: { id: { in: ids }, type: { in: config.products } }, select: { id: true } });
  if (found.length !== ids.length) throw new AdminError("VALIDACAO", "Alguma conta selecionada não existe ou não é do produto escolhido.");
  return ids;
}

function versionData(config: CouponConfig, actorId: string) {
  const { code: _code, name: _name, ...rules } = config;
  return { ...rules, products: rules.products as CouponProduct[] as TenantType[], cycles: rules.cycles as CouponCycle[] as BillingCycle[], segments: rules.segments as CouponSegment[] as string[], createdById: actorId };
}

export async function previewCouponInput(input: CouponConfigInput & { selectedTenantIds?: unknown }, client: PrismaClient = prisma, now = new Date()): Promise<CouponPreview> {
  const config = parse(input);
  const selected = await resolveSelected(config, input.selectedTenantIds, client);
  return previewCoupon(config, selected, client, now);
}

/// Nova campanha em rascunho (versão 1).
export async function createCoupon(actorId: string, input: CouponConfigInput & { selectedTenantIds?: unknown }, client: PrismaClient = prisma): Promise<{ id: string }> {
  const config = parse(input);
  try {
    return await client.$transaction(async (tx) => {
      const selected = await resolveSelected(config, input.selectedTenantIds, tx);
      const coupon = await tx.coupon.create({ data: { code: config.code, name: config.name, createdById: actorId } });
      const version = await tx.couponVersion.create({ data: { couponId: coupon.id, version: 1, ...versionData(config, actorId) } });
      if (selected.length) await tx.couponAudienceMember.createMany({ data: selected.map((tenantId) => ({ versionId: version.id, tenantId, selectedById: actorId })) });
      await tx.coupon.update({ where: { id: coupon.id }, data: { currentVersionId: version.id } });
      await tx.couponAudit.create({ data: { couponId: coupon.id, actorId, operation: "CRIADO", after: { ...config, selected } as unknown as Prisma.InputJsonValue } });
      return { id: coupon.id };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new AdminError("CONFLITO", "Já existe um cupom com este código.");
    throw error;
  }
}

/// Editar: rascunho muda a própria versão; depois de ativado, cria uma
/// versão nova (o que já foi resgatado guarda as condições aceitas). O
/// código não muda.
export async function updateCoupon(actorId: string, id: string, input: CouponConfigInput & { selectedTenantIds?: unknown }, client: PrismaClient = prisma): Promise<{ id: string; version: number }> {
  const coupon = await client.coupon.findUnique({ where: { id }, include: { currentVersion: true } });
  if (!coupon?.currentVersion) throw new AdminError("NAO_ENCONTRADO", "Cupom não encontrado.");
  if (coupon.status === "ENDED" || coupon.status === "ARCHIVED") throw new AdminError("CONFLITO", "Campanha encerrada não pode ser editada.");
  const config = parse({ ...input, code: coupon.code });
  return client.$transaction(async (tx) => {
    const selected = await resolveSelected(config, input.selectedTenantIds, tx);
    const before = coupon.currentVersion!;
    let versionId = before.id;
    let versionNumber = before.version;
    if (coupon.status === "DRAFT") {
      await tx.couponVersion.update({ where: { id: before.id }, data: versionData(config, actorId) });
      await tx.couponAudienceMember.deleteMany({ where: { versionId: before.id } });
    } else {
      versionNumber = before.version + 1;
      versionId = (await tx.couponVersion.create({ data: { couponId: id, version: versionNumber, ...versionData(config, actorId) } })).id;
    }
    if (selected.length) await tx.couponAudienceMember.createMany({ data: selected.map((tenantId) => ({ versionId, tenantId, selectedById: actorId })) });
    await tx.coupon.update({ where: { id }, data: { name: config.name, currentVersionId: versionId } });
    await tx.couponAudit.create({ data: { couponId: id, actorId, operation: coupon.status === "DRAFT" ? "EDITADO" : "NOVA_VERSAO", before: before as unknown as Prisma.InputJsonValue, after: { ...config, selected } as unknown as Prisma.InputJsonValue } });
    return { id, version: versionNumber };
  });
}

export type CouponAction = "ATIVAR" | "PAUSAR" | "RETOMAR" | "ENCERRAR" | "ARQUIVAR";

const TRANSITIONS: Record<CouponAction, { from: CouponStatus[]; to: CouponStatus; operation: string }> = {
  ATIVAR: { from: ["DRAFT"], to: "ACTIVE", operation: "ATIVADO" },
  PAUSAR: { from: ["ACTIVE"], to: "PAUSED", operation: "PAUSADO" },
  RETOMAR: { from: ["PAUSED"], to: "ACTIVE", operation: "RETOMADO" },
  ENCERRAR: { from: ["ACTIVE", "PAUSED"], to: "ENDED", operation: "ENCERRADO" },
  ARQUIVAR: { from: ["DRAFT", "ENDED"], to: "ARCHIVED", operation: "ARQUIVADO" },
};

/// Muda o estado da campanha. Ativar e retomar refazem a prévia: nada de
/// cupom que zera cobrança ou aponta para plano de preço zero. Pausar e
/// encerrar só impedem novos resgates (os já feitos seguem, ADR-021).
export async function setCouponStatus(actorId: string, id: string, action: unknown, client: PrismaClient = prisma, now = new Date()): Promise<{ status: CouponStatus }> {
  if (typeof action !== "string" || !(action in TRANSITIONS)) throw new AdminError("VALIDACAO", "Ação inválida.");
  const transition = TRANSITIONS[action as CouponAction];
  const coupon = await client.coupon.findUnique({ where: { id }, include: { currentVersion: { include: { members: { select: { tenantId: true } } } } } });
  if (!coupon?.currentVersion) throw new AdminError("NAO_ENCONTRADO", "Cupom não encontrado.");
  if (!transition.from.includes(coupon.status)) throw new AdminError("CONFLITO", "Esta ação não vale para o estado atual da campanha.");
  if (transition.to === "ACTIVE") {
    const version = coupon.currentVersion;
    const config = parse({ ...version, code: coupon.code, name: coupon.name });
    const preview = await previewCoupon(config, version.members.map((member) => member.tenantId), client, now);
    if (preview.problems.length) throw new AdminError("VALIDACAO", preview.problems[0]!);
    if (version.endsAt && version.endsAt.getTime() <= now.getTime()) throw new AdminError("VALIDACAO", "O prazo de resgate já terminou.");
  }
  const { count } = await client.coupon.updateMany({ where: { id, status: coupon.status }, data: { status: transition.to } });
  if (count === 0) throw new AdminError("CONFLITO", "A campanha mudou enquanto você editava. Atualize a página.");
  await client.couponAudit.create({ data: { couponId: id, actorId, operation: transition.operation, before: { status: coupon.status }, after: { status: transition.to } } });
  return { status: transition.to };
}

/// Busca de contas para o público "Selecionados" (nome do espaço ou e-mail
/// do dono). Só personal e Livre; nunca aluno.
export async function searchCouponAccounts(query: string, products: TenantType[], client: PrismaClient = prisma): Promise<{ tenantId: string; name: string; ownerEmail: string; type: TenantType }[]> {
  const term = query.trim();
  if (term.length < 2) return [];
  const tenants = await client.tenant.findMany({
    where: { type: { in: products }, OR: [{ name: { contains: term, mode: "insensitive" } }, { owner: { email: { contains: term, mode: "insensitive" } } }] },
    select: { id: true, name: true, type: true, owner: { select: { email: true } } },
    orderBy: { name: "asc" },
    take: 20,
  });
  return tenants.map((tenant) => ({ tenantId: tenant.id, name: tenant.name, ownerEmail: tenant.owner.email, type: tenant.type }));
}
