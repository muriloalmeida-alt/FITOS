/// Cupons de desconto (feature 5, ADR-021): regras puras de código, preço,
/// acumulação, público e configuração. Usadas no servidor (autoridade) e
/// nas telas (prévia). Valores sempre em centavos inteiros; percentual em
/// basis points (1% = 100).

export const COUPON_KINDS = ["PERCENT", "FIXED_AMOUNT"] as const;
export type CouponKind = (typeof COUPON_KINDS)[number];

export const COUPON_SEGMENTS = ["NOVOS", "ATIVOS", "INATIVOS", "SELECIONADOS"] as const;
export type CouponSegment = (typeof COUPON_SEGMENTS)[number];

export const COUPON_PRODUCTS = ["PERSONAL", "INDIVIDUAL"] as const;
export type CouponProduct = (typeof COUPON_PRODUCTS)[number];

export const COUPON_CYCLES = ["MENSAL", "ANUAL"] as const;
export type CouponCycle = (typeof COUPON_CYCLES)[number];

/// Duração permitida, em ciclos pagos. Sem perpétuo.
export const COUPON_DURATIONS = [1, 2, 3, 6, 12] as const;

export class CouponRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CouponRuleError";
  }
}

/// "  black-friday " → "BLACK-FRIDAY"; `null` quando não é um código válido.
export function normalizeCouponCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  return /^[A-Z0-9-]{3,32}$/.test(code) ? code : null;
}

export interface CouponTerms {
  kind: CouponKind;
  /// PERCENT: basis points (1..10000). FIXED_AMOUNT: centavos (> 0).
  amount: number;
  stackable: boolean;
}

/// Desconto de um cupom sobre uma base, arredondado uma única vez.
export function couponDiscountCents(baseCents: number, terms: Pick<CouponTerms, "kind" | "amount">): number {
  if (!(baseCents > 0)) return 0;
  if (terms.kind === "FIXED_AMOUNT") return Math.min(terms.amount, baseCents);
  // roundHalfUp(base × bps / 10000) em inteiros, sem ponto flutuante.
  return Math.min(baseCents, Math.floor((baseCents * terms.amount + 5000) / 10_000));
}

export interface PriceBreakdown {
  baseCents: number;
  /// Na ordem aplicada.
  discounts: { index: number; cents: number }[];
  discountCents: number;
  finalCents: number;
}

/// Regra aprovada: sem acumular por padrão; um cupom acumulável combina
/// com no máximo 1 outro acumulável. Devolve a mensagem do conflito.
export function stackingConflict(terms: Pick<CouponTerms, "stackable">[]): string | null {
  if (terms.length <= 1) return null;
  if (terms.length > 2) return "No máximo dois cupons por cobrança.";
  if (!terms.every((entry) => entry.stackable)) return "Este cupom não pode ser usado junto com outro.";
  return null;
}

/// Preço final com até dois cupons: primeiro o valor fixo, depois o
/// percentual sobre o restante; nunca abaixo de zero.
export function priceWithCoupons(baseCents: number, coupons: CouponTerms[]): PriceBreakdown {
  const conflict = stackingConflict(coupons);
  if (conflict) throw new CouponRuleError(conflict);
  const order = coupons.map((terms, index) => ({ terms, index })).sort((a, b) => (a.terms.kind === b.terms.kind ? a.index - b.index : a.terms.kind === "FIXED_AMOUNT" ? -1 : 1));
  let remaining = Math.max(0, baseCents);
  const discounts: PriceBreakdown["discounts"] = [];
  for (const { terms, index } of order) {
    const cents = couponDiscountCents(remaining, terms);
    remaining -= cents;
    discounts.push({ index, cents });
  }
  return { baseCents, discounts, discountCents: baseCents - remaining, finalCents: remaining };
}

/// Fatos da conta no instante do resgate (o servidor monta; a regra é pura).
export interface AccountFacts {
  tenantType: "PERSONAL" | "INDIVIDUAL";
  /// `null`: nunca assinou.
  subscriptionStatus: "ATIVA" | "INADIMPLENTE" | "CANCELADA" | null;
  /// Alguma cobrança SaaS já foi paga.
  hasPaidCharge: boolean;
  /// Fim do período pago vigente (cancelada com período pago ainda vale).
  paidAccessUntil: Date | null;
  /// Está na lista de selecionados da campanha.
  selected: boolean;
}

/// Segmentos de ciclo de vida da conta (ADR-021, decisão 2).
/// Inadimplente não é inativo e não cai em nenhum segmento por padrão.
export function lifecycleSegments(facts: AccountFacts, now: Date): CouponSegment[] {
  const segments: CouponSegment[] = [];
  if (!facts.hasPaidCharge && facts.subscriptionStatus !== "INADIMPLENTE") segments.push("NOVOS");
  if (facts.subscriptionStatus === "ATIVA" && facts.hasPaidCharge) segments.push("ATIVOS");
  const paidStillValid = facts.paidAccessUntil !== null && facts.paidAccessUntil.getTime() > now.getTime();
  if (facts.subscriptionStatus === "CANCELADA" && facts.hasPaidCharge && !paidStillValid) segments.push("INATIVOS");
  return segments;
}

export interface AudienceRules {
  products: CouponProduct[];
  /// NOVOS/ATIVOS/INATIVOS (OU entre eles) ou só SELECIONADOS.
  segments: CouponSegment[];
}

/// Público: produto E (segmento de ciclo de vida OU …); em SELECIONADOS a
/// lista é obrigatória e se soma (E) às demais regras, sem atalho.
export function audienceMatches(rules: AudienceRules, facts: AccountFacts, now: Date): boolean {
  if (!rules.products.includes(facts.tenantType)) return false;
  if (rules.segments.includes("SELECIONADOS")) return facts.selected && facts.subscriptionStatus !== "INADIMPLENTE";
  const lifecycle = lifecycleSegments(facts, now);
  return rules.segments.some((segment) => lifecycle.includes(segment));
}

/// Janela de resgate com fim exclusivo; `null` = sem limite.
export function withinWindow(window: { startsAt: Date | null; endsAt: Date | null }, now: Date): boolean {
  if (window.startsAt && now.getTime() < window.startsAt.getTime()) return false;
  if (window.endsAt && now.getTime() >= window.endsAt.getTime()) return false;
  return true;
}

export interface CouponConfigInput {
  code: unknown;
  name: unknown;
  kind: unknown;
  amount: unknown;
  products: unknown;
  segments: unknown;
  planIds: unknown;
  cycles: unknown;
  startsAt: unknown;
  endsAt: unknown;
  durationCycles: unknown;
  maxRedemptions: unknown;
  perAccountLimit: unknown;
  budgetCents: unknown;
  stackable: unknown;
  note: unknown;
}

export interface CouponConfig {
  code: string;
  name: string;
  kind: CouponKind;
  amount: number;
  products: CouponProduct[];
  segments: CouponSegment[];
  planIds: string[];
  cycles: CouponCycle[];
  startsAt: Date | null;
  endsAt: Date | null;
  durationCycles: number;
  maxRedemptions: number | null;
  perAccountLimit: number;
  budgetCents: number | null;
  stackable: boolean;
  note: string | null;
}

function list<T extends string>(value: unknown, allowed: readonly T[], label: string): T[] {
  if (!Array.isArray(value) || value.length === 0) throw new CouponRuleError(`Escolha ${label}.`);
  const unique = [...new Set(value)];
  if (!unique.every((entry): entry is T => typeof entry === "string" && (allowed as readonly string[]).includes(entry))) throw new CouponRuleError(`${label[0]!.toUpperCase()}${label.slice(1)} inválido.`);
  return unique;
}

function optionalPositiveInt(value: unknown, label: string): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) throw new CouponRuleError(`${label} inválido.`);
  return value;
}

function optionalDate(value: unknown, label: string): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = new Date(typeof value === "string" || value instanceof Date ? value : NaN);
  if (Number.isNaN(date.getTime())) throw new CouponRuleError(`${label} inválida.`);
  return date;
}

/// Configuração do administrador, validada. Nunca confia no cliente.
export function parseCouponConfig(input: CouponConfigInput): CouponConfig {
  const code = normalizeCouponCode(input.code);
  if (!code) throw new CouponRuleError("Código: de 3 a 32 caracteres, só letras, números e hífen.");
  const name = typeof input.name === "string" ? input.name.trim().slice(0, 80) : "";
  if (!name) throw new CouponRuleError("Dê um nome interno à campanha.");
  if (input.kind !== "PERCENT" && input.kind !== "FIXED_AMOUNT") throw new CouponRuleError("Tipo de desconto inválido.");
  const amount = input.amount;
  if (typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0) throw new CouponRuleError("Informe o valor do desconto.");
  if (input.kind === "PERCENT" && amount > 10_000) throw new CouponRuleError("Percentual entre 0,01% e 100%.");
  const segments = list(input.segments, COUPON_SEGMENTS, "o público");
  if (segments.includes("SELECIONADOS") && segments.length > 1) throw new CouponRuleError("Contas selecionadas não se combinam com outros públicos.");
  const planIds = Array.isArray(input.planIds) ? [...new Set(input.planIds.filter((id): id is string => typeof id === "string" && id.length > 0))] : [];
  if (planIds.length === 0) throw new CouponRuleError("Escolha pelo menos um plano.");
  const durationCycles = input.durationCycles;
  if (typeof durationCycles !== "number" || !(COUPON_DURATIONS as readonly number[]).includes(durationCycles)) throw new CouponRuleError("Duração: 1, 2, 3, 6 ou 12 ciclos.");
  const startsAt = optionalDate(input.startsAt, "Data de início");
  const endsAt = optionalDate(input.endsAt, "Data de fim");
  if (startsAt && endsAt && endsAt.getTime() <= startsAt.getTime()) throw new CouponRuleError("O fim do resgate precisa ser depois do início.");
  const perAccountLimit = optionalPositiveInt(input.perAccountLimit, "Limite por conta") ?? 1;
  const note = typeof input.note === "string" && input.note.trim() ? input.note.trim().slice(0, 500) : null;
  return {
    code,
    name,
    kind: input.kind,
    amount,
    products: list(input.products, COUPON_PRODUCTS, "o produto"),
    segments,
    planIds,
    cycles: list(input.cycles, COUPON_CYCLES, "o ciclo"),
    startsAt,
    endsAt,
    durationCycles,
    maxRedemptions: optionalPositiveInt(input.maxRedemptions, "Limite total"),
    perAccountLimit,
    budgetCents: optionalPositiveInt(input.budgetCents, "Orçamento"),
    stackable: input.stackable === true,
    note,
  };
}

/// "20% por 3 ciclos. Depois, preço vigente do plano."
export function couponSummary(terms: { kind: CouponKind; amount: number; durationCycles: number }): string {
  const value = terms.kind === "PERCENT" ? `${(terms.amount / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%` : formatCents(terms.amount);
  const cycles = terms.durationCycles === 1 ? "1 ciclo" : `${terms.durationCycles} ciclos`;
  return `${value} de desconto por ${cycles}. Depois, preço vigente do plano.`;
}

/// "R$ 49,90".
export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
