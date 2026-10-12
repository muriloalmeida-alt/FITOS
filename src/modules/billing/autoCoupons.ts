import "server-only";
import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { AdminError } from "@/modules/admin/users";
import { createCoupon, setCouponStatus } from "./coupons";
import { quoteCoupon, redeemCoupon } from "./couponRedemptions";

/// Cupons criados pelo próprio FitOS (CRM de convites e indicação do
/// FitOS Livre): uso único, um ciclo mensal, planos mensais pagos do
/// Livre. Ficam na lista de cupons do admin como qualquer campanha.

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function randomCode(alphabet: string, length: number): string {
  return Array.from(randomBytes(length), (byte) => alphabet[byte % alphabet.length]).join("");
}

/// Planos mensais pagos do FitOS Livre: onde os cupons automáticos valem.
export async function livreMonthlyPlanIds(client: PrismaClient = prisma): Promise<string[]> {
  const plans = await client.plan.findMany({ where: { audience: "INDIVIDUAL", active: true, billingCycle: "MENSAL", priceCents: { gt: 0 } }, select: { id: true } });
  if (plans.length === 0) throw new AdminError("CONFLITO", "Não há plano mensal pago do FitOS Livre ativo para o cupom.");
  return plans.map((plan) => plan.id);
}

export interface AutoCouponInput {
  /// Prefixo do código ("CONHECA", "AMIGO"...).
  prefix: string;
  name: string;
  /// Basis points (10% = 1000).
  percentBps: number;
  note: string;
  /// Só estas contas (segmento SELECIONADOS); vazio = contas novas.
  tenantIds?: string[];
  planIds?: string[];
}

/// Cria e ativa um cupom de uso único para um ciclo mensal.
export async function createAutoCoupon(actorId: string, input: AutoCouponInput, client: PrismaClient = prisma): Promise<{ id: string; code: string }> {
  const planIds = input.planIds ?? (await livreMonthlyPlanIds(client));
  const selected = input.tenantIds ?? [];
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const code = `${input.prefix}-${randomCode(CODE_ALPHABET, 6)}`;
    try {
      const { id } = await createCoupon(
        actorId,
        {
          code,
          name: input.name.slice(0, 80),
          kind: "PERCENT",
          amount: input.percentBps,
          products: ["INDIVIDUAL"],
          segments: selected.length ? ["SELECIONADOS"] : ["NOVOS"],
          planIds,
          cycles: ["MENSAL"],
          startsAt: null,
          endsAt: null,
          durationCycles: 1,
          maxRedemptions: 1,
          perAccountLimit: 1,
          budgetCents: null,
          stackable: false,
          note: input.note,
          selectedTenantIds: selected,
        },
        client
      );
      await setCouponStatus(actorId, id, "ATIVAR", client);
      return { id, code };
    } catch (error) {
      // Código repetido (raro): tenta outro.
      if (error instanceof AdminError && /Já existe um cupom/.test(error.message)) continue;
      throw error;
    }
  }
  throw new AdminError("CONFLITO", "Não foi possível gerar um código de cupom. Tente de novo.");
}

/// Aplica um cupom na conta (consulta + resgate idempotente pela chave).
export async function applyCouponToTenant(input: { tenantId: string; userId: string; code: string; operationKey: string }, client: PrismaClient = prisma, now = new Date()): Promise<void> {
  const quote = await quoteCoupon({ tenantId: input.tenantId }, input.code, client, now);
  await redeemCoupon({ tenantId: input.tenantId, actorUserId: input.userId, code: input.code, operationKey: input.operationKey, revision: quote.revision }, client, now);
}
