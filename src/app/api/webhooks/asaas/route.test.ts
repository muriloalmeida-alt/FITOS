import { afterEach, describe, expect, it, vi } from "vitest";

const parseAsaasWebhookPayload = vi.fn();
const reconcileAsaasPaymentEvent = vi.fn();

vi.mock("@/modules/billing/asaasWebhook", async () => {
  const actual = await vi.importActual<typeof import("@/modules/billing/asaasWebhook")>("@/modules/billing/asaasWebhook");
  return {
    ...actual,
    parseAsaasWebhookPayload: (...args: unknown[]) => parseAsaasWebhookPayload(...args),
    reconcileAsaasPaymentEvent: (...args: unknown[]) => reconcileAsaasPaymentEvent(...args),
  };
});

const TOKEN_HEADER = "asaas-access-token";
const WEBHOOK_URL = "http://localhost/api/webhooks/asaas";

function postWebhook(body: unknown, headers: Record<string, string> = {}) {
  return new Request(WEBHOOK_URL, { method: "POST", headers, body: JSON.stringify(body) });
}

describe("POST /api/webhooks/asaas", () => {
  const originalToken = process.env.API_ASAAS_WEBHOOK_TOKEN;

  afterEach(() => {
    vi.resetAllMocks();
    process.env.API_ASAAS_WEBHOOK_TOKEN = originalToken;
  });

  it("retorna 503 quando API_ASAAS_WEBHOOK_TOKEN não está configurado", async () => {
    delete process.env.API_ASAAS_WEBHOOK_TOKEN;

    const { POST } = await import("./route");
    const response = await POST(postWebhook({ event: "PAYMENT_RECEIVED" }, { [TOKEN_HEADER]: "qualquer" }));

    expect(response.status).toBe(503);
    expect(parseAsaasWebhookPayload).not.toHaveBeenCalled();
  });

  it("retorna 401 quando o header de token está ausente", async () => {
    process.env.API_ASAAS_WEBHOOK_TOKEN = "segredo-configurado";

    const { POST } = await import("./route");
    const response = await POST(postWebhook({ event: "PAYMENT_RECEIVED" }));

    expect(response.status).toBe(401);
    expect(parseAsaasWebhookPayload).not.toHaveBeenCalled();
  });

  it("retorna 401 quando o header de token está incorreto", async () => {
    process.env.API_ASAAS_WEBHOOK_TOKEN = "segredo-configurado";

    const { POST } = await import("./route");
    const response = await POST(postWebhook({ event: "PAYMENT_RECEIVED" }, { [TOKEN_HEADER]: "errado" }));

    expect(response.status).toBe(401);
    expect(parseAsaasWebhookPayload).not.toHaveBeenCalled();
  });

  it("retorna 400 quando o payload não é reconhecível", async () => {
    process.env.API_ASAAS_WEBHOOK_TOKEN = "segredo-configurado";
    parseAsaasWebhookPayload.mockReturnValue(null);

    const { POST } = await import("./route");
    const response = await POST(postWebhook({ nada: "a ver" }, { [TOKEN_HEADER]: "segredo-configurado" }));

    expect(response.status).toBe(400);
    expect(reconcileAsaasPaymentEvent).not.toHaveBeenCalled();
  });

  it("retorna 200 e reconcilia quando o token e o payload são válidos", async () => {
    process.env.API_ASAAS_WEBHOOK_TOKEN = "segredo-configurado";
    const payload = { event: "PAYMENT_RECEIVED", payment: { id: "pay_1", subscription: "sub_1", customer: null } };
    parseAsaasWebhookPayload.mockReturnValue(payload);
    reconcileAsaasPaymentEvent.mockResolvedValue({ outcome: "ATIVA_APLICADA", tenantId: "tenant-1" });

    const { POST } = await import("./route");
    const response = await POST(postWebhook(payload, { [TOKEN_HEADER]: "segredo-configurado" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "recebido" });
    expect(reconcileAsaasPaymentEvent).toHaveBeenCalledWith(payload);
  });

  it("retorna 200 mesmo quando nenhuma assinatura local corresponde ao evento (nunca faz o Asaas reentregar por isso)", async () => {
    process.env.API_ASAAS_WEBHOOK_TOKEN = "segredo-configurado";
    const payload = { event: "PAYMENT_RECEIVED", payment: { id: "pay_2", subscription: "sub_desconhecida", customer: null } };
    parseAsaasWebhookPayload.mockReturnValue(payload);
    reconcileAsaasPaymentEvent.mockResolvedValue({ outcome: "IGNORADO_SEM_ASSINATURA_LOCAL", tenantId: null });

    const { POST } = await import("./route");
    const response = await POST(postWebhook(payload, { [TOKEN_HEADER]: "segredo-configurado" }));

    expect(response.status).toBe(200);
  });
});
