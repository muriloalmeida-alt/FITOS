import { afterEach, describe, expect, it, vi } from "vitest";

const requireSubscriber = vi.fn();
const cancelSubscription = vi.fn();

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requireSubscriber: (...args: unknown[]) => requireSubscriber(...args) };
});

vi.mock("@/modules/billing/subscriptions", async () => {
  const actual = await vi.importActual<typeof import("@/modules/billing/subscriptions")>("@/modules/billing/subscriptions");
  return { ...actual, cancelSubscription: (...args: unknown[]) => cancelSubscription(...args) };
});

describe("POST /api/tenancy/minha-assinatura/cancelar", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requireSubscriber.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/tenancy/minha-assinatura/cancelar", { method: "POST", body: "{}" })
    );

    expect(response.status).toBe(401);
  });

  it("cancela usando o tenantId da sessão, nunca do corpo", async () => {
    requireSubscriber.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real", tenantType: "PERSONAL" });
    cancelSubscription.mockResolvedValue({ id: "sub1", status: "CANCELADA" });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/tenancy/minha-assinatura/cancelar", {
        method: "POST",
        body: JSON.stringify({ reason: "Não preciso mais", tenantId: "outro-tenant" }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("CANCELADA");
    expect(cancelSubscription).toHaveBeenCalledWith({ tenantId: "tenant-real", actorUserId: "u1", reason: "Não preciso mais" });
  });

  it("retorna 400 quando o motivo é vazio", async () => {
    const { SubscriptionError } = await vi.importActual<typeof import("@/modules/billing/subscriptions")>(
      "@/modules/billing/subscriptions"
    );
    requireSubscriber.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "t1", tenantType: "PERSONAL" });
    cancelSubscription.mockRejectedValue(new SubscriptionError("VALIDACAO", "Informe o motivo do cancelamento."));

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/tenancy/minha-assinatura/cancelar", { method: "POST", body: JSON.stringify({ reason: "" }) })
    );

    expect(response.status).toBe(400);
  });

  it("retorna 404 quando o tenant não tem assinatura", async () => {
    const { SubscriptionError } = await vi.importActual<typeof import("@/modules/billing/subscriptions")>(
      "@/modules/billing/subscriptions"
    );
    requireSubscriber.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "t1", tenantType: "PERSONAL" });
    cancelSubscription.mockRejectedValue(new SubscriptionError("NAO_ENCONTRADO", "Nenhuma assinatura encontrada."));

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/tenancy/minha-assinatura/cancelar", {
        method: "POST",
        body: JSON.stringify({ reason: "motivo" }),
      })
    );

    expect(response.status).toBe(404);
  });
});
