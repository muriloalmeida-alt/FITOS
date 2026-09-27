import { afterEach, describe, expect, it, vi } from "vitest";

const requireSubscriber = vi.fn();
const getSubscriptionForTenant = vi.fn();
const listActivePlansForAudience = vi.fn();
const subscribeTenantToPlan = vi.fn();

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requireSubscriber: (...args: unknown[]) => requireSubscriber(...args) };
});

vi.mock("@/modules/billing/plans", async () => {
  const actual = await vi.importActual<typeof import("@/modules/billing/plans")>("@/modules/billing/plans");
  return { ...actual, listActivePlansForAudience: (...args: unknown[]) => listActivePlansForAudience(...args) };
});

vi.mock("@/modules/billing/subscriptions", async () => {
  const actual = await vi.importActual<typeof import("@/modules/billing/subscriptions")>("@/modules/billing/subscriptions");
  return {
    ...actual,
    getSubscriptionForTenant: (...args: unknown[]) => getSubscriptionForTenant(...args),
    subscribeTenantToPlan: (...args: unknown[]) => subscribeTenantToPlan(...args),
  };
});

describe("GET /api/tenancy/minha-assinatura", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requireSubscriber.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("retorna assinatura e planos da audiência da sessão", async () => {
    requireSubscriber.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real", tenantType: "PERSONAL" });
    getSubscriptionForTenant.mockResolvedValue({ id: "sub1", status: "ATIVA" });
    listActivePlansForAudience.mockResolvedValue([{ id: "plan1", slug: "personal-essencial" }]);

    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.subscription).toEqual({ id: "sub1", status: "ATIVA" });
    expect(body.plans).toEqual([{ id: "plan1", slug: "personal-essencial" }]);
    expect(getSubscriptionForTenant).toHaveBeenCalledWith("tenant-real");
    expect(listActivePlansForAudience).toHaveBeenCalledWith("PERSONAL");
  });
});

describe("POST /api/tenancy/minha-assinatura", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requireSubscriber.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/tenancy/minha-assinatura", { method: "POST", body: "{}" }));

    expect(response.status).toBe(401);
  });

  it("contrata usando o tenantId/tenantType da sessão, nunca do corpo", async () => {
    requireSubscriber.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real", tenantType: "PERSONAL" });
    subscribeTenantToPlan.mockResolvedValue({ id: "sub1", planId: "plan1", status: "ATIVA" });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/tenancy/minha-assinatura", {
        method: "POST",
        body: JSON.stringify({ planId: "plan1", tenantId: "outro-tenant", tenantType: "INDIVIDUAL" }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.planId).toBe("plan1");
    expect(subscribeTenantToPlan).toHaveBeenCalledWith({
      tenantId: "tenant-real",
      tenantType: "PERSONAL",
      planId: "plan1",
      actorUserId: "u1",
    });
  });

  it("retorna 409 quando a audiência do plano é incompatível", async () => {
    const { SubscriptionError } = await vi.importActual<typeof import("@/modules/billing/subscriptions")>(
      "@/modules/billing/subscriptions"
    );
    requireSubscriber.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "t1", tenantType: "PERSONAL" });
    subscribeTenantToPlan.mockRejectedValue(new SubscriptionError("AUDIENCIA_INCOMPATIVEL", "Este plano não está disponível."));

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/tenancy/minha-assinatura", { method: "POST", body: JSON.stringify({ planId: "plan1" }) })
    );

    expect(response.status).toBe(409);
  });

  it("retorna 404 quando o plano não existe", async () => {
    const { SubscriptionError } = await vi.importActual<typeof import("@/modules/billing/subscriptions")>(
      "@/modules/billing/subscriptions"
    );
    requireSubscriber.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "t1", tenantType: "PERSONAL" });
    subscribeTenantToPlan.mockRejectedValue(new SubscriptionError("NAO_ENCONTRADO", "Plano não encontrado."));

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/tenancy/minha-assinatura", { method: "POST", body: JSON.stringify({ planId: "inexistente" }) })
    );

    expect(response.status).toBe(404);
  });
});
