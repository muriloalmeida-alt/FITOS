import type { Plan, SaasSubscription } from "@prisma/client";

/// Fim do teste grátis sem cartão (EPIC-38). Depois do teste, 3 dias de
/// carência com aviso em todas as telas; passado isso, o dono do espaço
/// (personal ou FitOS Livre) só acessa Assinatura, Perfil e Configurações
/// até cadastrar o cartão. Os alunos do personal continuam treinando.

export const GRACE_DAYS = 3;
const DAY_MS = 86_400_000;

export type AccessState = { kind: "LIBERADO" } | { kind: "CARENCIA"; blockOn: Date } | { kind: "BLOQUEADO"; since: Date };

export function subscriptionAccess(subscription: (SaasSubscription & { plan: Pick<Plan, "priceCents"> }) | null, now: Date): AccessState {
  if (!subscription || subscription.status !== "ATIVA" || subscription.plan.priceCents <= 0 || subscription.creditCardLast4 || !subscription.trialEndsAt) {
    return { kind: "LIBERADO" };
  }
  if (now < subscription.trialEndsAt) return { kind: "LIBERADO" };
  const blockOn = new Date(subscription.trialEndsAt.getTime() + GRACE_DAYS * DAY_MS);
  return now < blockOn ? { kind: "CARENCIA", blockOn } : { kind: "BLOQUEADO", since: blockOn };
}

/// Telas que continuam abertas no bloqueio.
export const ALLOWED_WHEN_BLOCKED = ["/painel/assinatura", "/painel/perfil", "/painel/configuracoes"] as const;

export function allowedWhenBlocked(pathname: string): boolean {
  return ALLOWED_WHEN_BLOCKED.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
