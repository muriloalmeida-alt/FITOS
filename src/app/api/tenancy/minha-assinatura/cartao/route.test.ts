import { afterEach, describe, expect, it, vi } from "vitest";

const requireSubscriber = vi.fn();
const attachCreditCardToSubscription = vi.fn();

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requireSubscriber: (...args: unknown[]) => requireSubscriber(...args) };
});

vi.mock("@/modules/billing/checkout", async () => {
  const actual = await vi.importActual<typeof import("@/modules/billing/checkout")>("@/modules/billing/checkout");
  return { ...actual, attachCreditCardToSubscription: (...args: unknown[]) => attachCreditCardToSubscription(...args) };
});

const VALID_BODY = {
  cardHolderName: "Fulano de Tal",
  cardNumber: "4111 1111 1111 1111",
  cardExpiryMonth: "10",
  cardExpiryYear: "2030",
  cardCcv: "123",
  postalCode: "01310-100",
  addressNumber: "100",
  phone: "11912345678",
};

function postCard(body: unknown) {
  return new Request("http://localhost/api/tenancy/minha-assinatura/cartao", { method: "POST", body: JSON.stringify(body) });
}

describe("POST /api/tenancy/minha-assinatura/cartao", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requireSubscriber.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { POST } = await import("./route");
    const response = await POST(postCard(VALID_BODY));

    expect(response.status).toBe(401);
    expect(attachCreditCardToSubscription).not.toHaveBeenCalled();
  });

  it("retorna 400 quando falta algum campo obrigatório", async () => {
    requireSubscriber.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "t1", tenantType: "PERSONAL" });

    const { POST } = await import("./route");
    const response = await POST(postCard({ ...VALID_BODY, cardNumber: "" }));

    expect(response.status).toBe(400);
    expect(attachCreditCardToSubscription).not.toHaveBeenCalled();
  });

  it("retorna 400 quando o número do cartão falha o checksum de Luhn", async () => {
    requireSubscriber.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "t1", tenantType: "PERSONAL" });

    const { POST } = await import("./route");
    const response = await POST(postCard({ ...VALID_BODY, cardNumber: "4111 1111 1111 1112" }));

    expect(response.status).toBe(400);
    expect(attachCreditCardToSubscription).not.toHaveBeenCalled();
  });

  it("retorna 400 quando a validade já está vencida", async () => {
    requireSubscriber.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "t1", tenantType: "PERSONAL" });

    const { POST } = await import("./route");
    const response = await POST(postCard({ ...VALID_BODY, cardExpiryMonth: "01", cardExpiryYear: "2020" }));

    expect(response.status).toBe(400);
    expect(attachCreditCardToSubscription).not.toHaveBeenCalled();
  });

  it("retorna 400 quando o CEP é inválido", async () => {
    requireSubscriber.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "t1", tenantType: "PERSONAL" });

    const { POST } = await import("./route");
    const response = await POST(postCard({ ...VALID_BODY, postalCode: "123" }));

    expect(response.status).toBe(400);
    expect(attachCreditCardToSubscription).not.toHaveBeenCalled();
  });

  it("usa tenantId/tenantType da sessão, nunca do corpo, e retorna 200 com os dados mascarados", async () => {
    requireSubscriber.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real", tenantType: "PERSONAL" });
    attachCreditCardToSubscription.mockResolvedValue({ creditCardLast4: "1111", creditCardBrand: "VISA" });

    const { POST } = await import("./route");
    const response = await POST(postCard({ ...VALID_BODY, tenantId: "outro-tenant", tenantType: "INDIVIDUAL" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ creditCardLast4: "1111", creditCardBrand: "VISA" });
    expect(attachCreditCardToSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "tenant-real", tenantType: "PERSONAL" })
    );
  });

  it("retorna 404 quando o tenant ainda não tem assinatura (SEM_ASSINATURA)", async () => {
    const { CheckoutError } = await vi.importActual<typeof import("@/modules/billing/checkout")>("@/modules/billing/checkout");
    requireSubscriber.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "t1", tenantType: "PERSONAL" });
    attachCreditCardToSubscription.mockRejectedValue(new CheckoutError("SEM_ASSINATURA", "Escolha um plano antes de cadastrar um cartão."));

    const { POST } = await import("./route");
    const response = await POST(postCard(VALID_BODY));

    expect(response.status).toBe(404);
  });

  it("retorna 422 quando o cartão é recusado pelo Asaas (CARTAO_RECUSADO)", async () => {
    const { CheckoutError } = await vi.importActual<typeof import("@/modules/billing/checkout")>("@/modules/billing/checkout");
    requireSubscriber.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "t1", tenantType: "PERSONAL" });
    attachCreditCardToSubscription.mockRejectedValue(new CheckoutError("CARTAO_RECUSADO", "Cartão de crédito inválido."));

    const { POST } = await import("./route");
    const response = await POST(postCard(VALID_BODY));
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.message).toBe("Cartão de crédito inválido.");
  });

  it("retorna 409 quando a assinatura ainda não foi ligada ao Asaas (SEM_LIGACAO_ASAAS)", async () => {
    const { CheckoutError } = await vi.importActual<typeof import("@/modules/billing/checkout")>("@/modules/billing/checkout");
    requireSubscriber.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "t1", tenantType: "PERSONAL" });
    attachCreditCardToSubscription.mockRejectedValue(new CheckoutError("SEM_LIGACAO_ASAAS", "Tente novamente em alguns minutos."));

    const { POST } = await import("./route");
    const response = await POST(postCard(VALID_BODY));

    expect(response.status).toBe(409);
  });
});
