import { describe, expect, it } from "vitest";
import { parseAsaasWebhookPayload } from "./asaasWebhook";

describe("parseAsaasWebhookPayload", () => {
  it("aceita um payload de pagamento com assinatura associada", () => {
    const payload = parseAsaasWebhookPayload({
      event: "PAYMENT_RECEIVED",
      payment: { id: "pay_1", subscription: "sub_1", customer: "cus_1" },
    });

    expect(payload).toEqual({ event: "PAYMENT_RECEIVED", payment: { id: "pay_1", subscription: "sub_1", customer: "cus_1" } });
  });

  it("aceita um payload de pagamento sem assinatura associada (subscription nulo)", () => {
    const payload = parseAsaasWebhookPayload({
      event: "PAYMENT_OVERDUE",
      payment: { id: "pay_2", subscription: null, customer: "cus_2" },
    });

    expect(payload).toEqual({ event: "PAYMENT_OVERDUE", payment: { id: "pay_2", subscription: null, customer: "cus_2" } });
  });

  it("rejeita corpo que não é um objeto", () => {
    expect(parseAsaasWebhookPayload(null)).toBeNull();
    expect(parseAsaasWebhookPayload("string")).toBeNull();
    expect(parseAsaasWebhookPayload(42)).toBeNull();
  });

  it("rejeita quando event está ausente ou não é string", () => {
    expect(parseAsaasWebhookPayload({ payment: { id: "pay_1" } })).toBeNull();
    expect(parseAsaasWebhookPayload({ event: 123, payment: { id: "pay_1" } })).toBeNull();
    expect(parseAsaasWebhookPayload({ event: "", payment: { id: "pay_1" } })).toBeNull();
  });

  it("rejeita quando payment está ausente ou payment.id não é string", () => {
    expect(parseAsaasWebhookPayload({ event: "PAYMENT_RECEIVED" })).toBeNull();
    expect(parseAsaasWebhookPayload({ event: "PAYMENT_RECEIVED", payment: null })).toBeNull();
    expect(parseAsaasWebhookPayload({ event: "PAYMENT_RECEIVED", payment: { id: 1 } })).toBeNull();
    expect(parseAsaasWebhookPayload({ event: "PAYMENT_RECEIVED", payment: { id: "" } })).toBeNull();
  });

  it("nunca lança, mesmo com campos extras desconhecidos no corpo", () => {
    expect(() =>
      parseAsaasWebhookPayload({
        event: "PAYMENT_RECEIVED",
        payment: { id: "pay_1", subscription: "sub_1", customer: "cus_1", value: 49.9, extra: { deep: true } },
        extraTopLevel: [1, 2, 3],
      })
    ).not.toThrow();
  });
});
