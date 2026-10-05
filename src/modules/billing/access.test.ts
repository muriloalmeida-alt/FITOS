import { describe, expect, it } from "vitest";
import type { Plan, SaasSubscription } from "@prisma/client";
import { allowedWhenBlocked, subscriptionAccess } from "./access";

const now = new Date("2026-10-10T12:00:00Z");
const sub = (over: Partial<SaasSubscription> = {}, priceCents = 4990) =>
  ({ status: "ATIVA", creditCardLast4: null, trialEndsAt: new Date("2026-10-08T12:00:00Z"), plan: { priceCents }, ...over }) as SaasSubscription & { plan: Pick<Plan, "priceCents"> };

describe("fim do teste grátis sem cartão (EPIC-38)", () => {
  it("liberado durante o teste, com cartão, plano grátis ou sem assinatura", () => {
    expect(subscriptionAccess(sub({ trialEndsAt: new Date("2026-10-11T00:00:00Z") }), now).kind).toBe("LIBERADO");
    expect(subscriptionAccess(sub({ creditCardLast4: "4242" }), now).kind).toBe("LIBERADO");
    expect(subscriptionAccess(sub({}, 0), now).kind).toBe("LIBERADO");
    expect(subscriptionAccess(sub({ status: "CANCELADA" }), now).kind).toBe("LIBERADO");
    expect(subscriptionAccess(null, now).kind).toBe("LIBERADO");
  });

  it("3 dias de carência depois do teste e, depois, bloqueio", () => {
    expect(subscriptionAccess(sub(), now)).toEqual({ kind: "CARENCIA", blockOn: new Date("2026-10-11T12:00:00Z") });
    expect(subscriptionAccess(sub(), new Date("2026-10-11T12:00:00Z"))).toEqual({ kind: "BLOQUEADO", since: new Date("2026-10-11T12:00:00Z") });
  });

  it("no bloqueio só Assinatura, Perfil e Configurações abrem", () => {
    expect(["/painel/assinatura", "/painel/perfil", "/painel/configuracoes", "/painel/assinatura/cartao"].every(allowedWhenBlocked)).toBe(true);
    expect(["/painel", "/painel/alunos", "/painel/treinos", "/painel/perfilx"].some(allowedWhenBlocked)).toBe(false);
  });
});
