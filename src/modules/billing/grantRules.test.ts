import { describe, expect, it } from "vitest";
import { externalBillingPlan, freeAccessUntil, grantEligibility, grantWindow, lastIncludedDay, paidThroughFromPayments, validateGrantInput } from "./grantRules";

const d = (iso: string) => new Date(iso);
const now = d("2026-10-07T15:00:00Z");

describe("janela da gratuidade (PDF 4, exemplos da seção 4.1)", () => {
  it("teste até 20/10 + 30 dias: começa no fim do teste", () => {
    const window = grantWindow(d("2026-10-20T15:00:00Z"), [], 30, now);
    expect(window).toEqual({ startsAt: d("2026-10-20T15:00:00Z"), endsAt: d("2026-11-19T15:00:00Z") });
    expect(lastIncludedDay(window.endsAt)).toBe("2026-11-19");
  });

  it("teste vencido e bloqueado: começa agora", () => {
    expect(grantWindow(d("2026-09-01T15:00:00Z"), [], 15, now)).toEqual({ startsAt: now, endsAt: d("2026-10-22T15:00:00Z") });
  });

  it("benefício até 19/11 + 15 dias: estende até 04/12, sem somar dias sobrepostos", () => {
    const previous = { startsAt: d("2026-10-20T15:00:00Z"), endsAt: d("2026-11-19T15:00:00Z") };
    expect(grantWindow(null, [previous], 15, now).endsAt).toEqual(d("2026-12-04T15:00:00Z"));
    expect(freeAccessUntil(d("2026-10-20T15:00:00Z"), [previous], now)).toEqual(previous.endsAt);
  });

  it("benefício já encerrado não empurra a base", () => {
    expect(grantWindow(null, [{ startsAt: d("2026-08-01T00:00:00Z"), endsAt: d("2026-09-01T00:00:00Z") }], 7, now).startsAt).toEqual(now);
  });

  it("fim exclusivo à meia-noite local: o último dia é o anterior; virada de ano", () => {
    expect(lastIncludedDay(d("2027-01-01T03:00:00Z"))).toBe("2026-12-31");
    expect(lastIncludedDay(d("2027-01-01T03:00:01Z"))).toBe("2027-01-01");
    expect(grantWindow(null, [], 60, d("2026-12-15T12:00:00Z")).endsAt).toEqual(d("2027-02-13T12:00:00Z"));
  });
});

describe("validação e elegibilidade", () => {
  it("dias de 1 a 365, motivo da lista, texto obrigatório só em Outro", () => {
    expect(validateGrantInput({ days: 30, reasonCode: "SUPORTE", reasonText: "" })).toBeNull();
    expect(validateGrantInput({ days: 0, reasonCode: "SUPORTE", reasonText: "" })).toMatch(/1 a 365/);
    expect(validateGrantInput({ days: 366, reasonCode: "SUPORTE", reasonText: "" })).toMatch(/1 a 365/);
    expect(validateGrantInput({ days: 1.5, reasonCode: "SUPORTE", reasonText: "" })).toMatch(/1 a 365/);
    expect(validateGrantInput({ days: 7, reasonCode: "toString", reasonText: "" })).toBe("Escolha o motivo.");
    expect(validateGrantInput({ days: 7, reasonCode: "OUTRO", reasonText: "  " })).toBe("Descreva o motivo.");
    expect(validateGrantInput({ days: 7, reasonCode: "OUTRO", reasonText: "x".repeat(301) })).toMatch(/300/);
  });

  it("só personal/Livre com plano pago; Asaas só com o ajuste ligado; cancelada só acesso", () => {
    const paid = { status: "ATIVA", externalSubscriptionId: null, creditCardLast4: null, plan: { priceCents: 4990 } };
    expect(grantEligibility("PERSONAL", paid, true)).toEqual({ ok: true, external: false });
    expect(grantEligibility("INDIVIDUAL", paid, true)).toEqual({ ok: true, external: false });
    expect(grantEligibility("ALUNO", paid, true)).toMatchObject({ ok: false, kind: "SEM_ESPACO" });
    expect(grantEligibility("ADMIN", paid, true)).toMatchObject({ ok: false, kind: "SEM_ESPACO" });
    expect(grantEligibility("PERSONAL", null, true)).toMatchObject({ ok: false, kind: "SEM_ASSINATURA" });
    expect(grantEligibility("PERSONAL", { ...paid, plan: { priceCents: 0 } }, true)).toMatchObject({ ok: false, kind: "PLANO_GRATUITO" });
    expect(grantEligibility("PERSONAL", { ...paid, externalSubscriptionId: "sub_1" }, true)).toMatchObject({ ok: false, kind: "COBRANCA_EXTERNA" });
    expect(grantEligibility("PERSONAL", { ...paid, creditCardLast4: "4242" }, true)).toMatchObject({ ok: false, kind: "COBRANCA_EXTERNA" });
    expect(grantEligibility("PERSONAL", { ...paid, externalSubscriptionId: "sub_1" }, true, true)).toEqual({ ok: true, external: true });
    expect(grantEligibility("PERSONAL", { ...paid, status: "CANCELADA", externalSubscriptionId: "sub_1" }, true)).toEqual({ ok: true, external: false });
  });
});

describe("cobrança no Asaas (fatia 3)", () => {
  const pay = (dueDate: string, status: string, id = dueDate) => ({ id, dueDate, status, value: 49.9 });

  it("período pago: cada cobrança paga cobre um ciclo; fim de mês não pula mês", () => {
    expect(paidThroughFromPayments([pay("2026-10-01", "CONFIRMED"), pay("2026-09-01", "RECEIVED")], "MONTHLY")).toEqual(d("2026-11-01T03:00:00Z"));
    expect(paidThroughFromPayments([pay("2026-01-31", "RECEIVED")], "MONTHLY")).toEqual(d("2026-02-28T03:00:00Z"));
    expect(paidThroughFromPayments([pay("2026-03-10", "RECEIVED")], "YEARLY")).toEqual(d("2027-03-10T03:00:00Z"));
    expect(paidThroughFromPayments([pay("2026-10-01", "PENDING")], "MONTHLY")).toBeNull();
  });

  it("pago até 01/11 + 30 dias: janela 01/11 a 01/12 e cobrança adiada para 01/12 (exemplo do PDF)", () => {
    const paidThrough = paidThroughFromPayments([pay("2026-10-01", "CONFIRMED")], "MONTHLY");
    const window = grantWindow(null, [], 30, now, paidThrough);
    expect(window).toEqual({ startsAt: d("2026-11-01T03:00:00Z"), endsAt: d("2026-12-01T03:00:00Z") });
    expect(lastIncludedDay(window.endsAt)).toBe("2026-11-30");
    expect(externalBillingPlan(window, "2026-11-01", [pay("2026-10-01", "CONFIRMED")])).toMatchObject({
      currentDueDate: "2026-11-01",
      targetDueDate: "2026-12-01",
      needsChange: true,
      openInWindow: [],
      oldDebts: [],
    });
  });

  it("cobrança já emitida dentro da janela bloqueia; atraso antigo só aparece; nunca antecipa", () => {
    const window = { startsAt: d("2026-11-01T03:00:00Z"), endsAt: d("2026-12-01T03:00:00Z") };
    const plan = externalBillingPlan(window, "2026-12-01", [pay("2026-11-01", "PENDING"), pay("2026-09-01", "OVERDUE"), pay("2026-12-01", "PENDING")]);
    expect(plan.openInWindow.map((payment) => payment.dueDate)).toEqual(["2026-11-01"]);
    expect(plan.oldDebts.map((payment) => payment.dueDate)).toEqual(["2026-09-01"]);
    expect(plan.needsChange).toBe(false);
    expect(externalBillingPlan(window, "2027-01-15", []).targetDueDate).toBe("2027-01-15");
  });
});
