import { afterEach, describe, expect, it, vi } from "vitest";

const requirePersonal = vi.fn();
const registerPayment = vi.fn();

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
    "@/modules/tenancy/authContext"
  );
  return { ...actual, requirePersonal: (...args: unknown[]) => requirePersonal(...args) };
});

vi.mock("@/modules/student-finance/charges", async () => {
  const actual = await vi.importActual<typeof import("@/modules/student-finance/charges")>(
    "@/modules/student-finance/charges"
  );
  return { ...actual, registerPayment: (...args: unknown[]) => registerPayment(...args) };
});

describe("POST /api/cobrancas/[id]/pagamentos", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
      "@/modules/tenancy/authContext"
    );
    requirePersonal.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/cobrancas/c1/pagamentos", { method: "POST", body: "{}" }), {
      params: Promise.resolve({ id: "c1" }),
    });

    expect(response.status).toBe(401);
  });

  it("retorna 400 quando o valor não é um número", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "t1" });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/cobrancas/c1/pagamentos", {
        method: "POST",
        body: JSON.stringify({ amountReceivedReais: "abc", paidAt: "2026-10-04", method: "PIX" }),
      }),
      { params: Promise.resolve({ id: "c1" }) }
    );

    expect(response.status).toBe(400);
    expect(registerPayment).not.toHaveBeenCalled();
  });

  it("registra usando o tenantId e actorUserId da sessão, nunca do corpo", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    registerPayment.mockResolvedValue({ id: "c1", status: "PAGO" });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/cobrancas/c1/pagamentos", {
        method: "POST",
        body: JSON.stringify({
          amountReceivedReais: 150,
          paidAt: "2026-10-04",
          method: "PIX",
          tenantId: "outro-tenant",
          actorUserId: "outro-user",
        }),
      }),
      { params: Promise.resolve({ id: "c1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.status).toBe("PAGO");
    const call = registerPayment.mock.calls[0]![0];
    expect(call.tenantId).toBe("tenant-real");
    expect(call.actorUserId).toBe("u1");
    expect(call.chargeId).toBe("c1");
    expect(call.amountReceivedReais).toBe(150);
    expect(call.method).toBe("PIX");
  });

  it("retorna 409 quando a cobrança já está paga", async () => {
    const { StudentChargeError } = await vi.importActual<typeof import("@/modules/student-finance/charges")>(
      "@/modules/student-finance/charges"
    );
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "t1" });
    registerPayment.mockRejectedValue(new StudentChargeError("ESTADO_INVALIDO", "Esta cobrança já está paga."));

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/cobrancas/c1/pagamentos", {
        method: "POST",
        body: JSON.stringify({ amountReceivedReais: 150, paidAt: "2026-10-04", method: "PIX" }),
      }),
      { params: Promise.resolve({ id: "c1" }) }
    );

    expect(response.status).toBe(409);
  });

  it("retorna 404 quando a cobrança não pertence ao tenant da sessão", async () => {
    const { StudentChargeError } = await vi.importActual<typeof import("@/modules/student-finance/charges")>(
      "@/modules/student-finance/charges"
    );
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "t1" });
    registerPayment.mockRejectedValue(new StudentChargeError("NAO_ENCONTRADO", "Cobrança não encontrada."));

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/cobrancas/c1/pagamentos", {
        method: "POST",
        body: JSON.stringify({ amountReceivedReais: 150, paidAt: "2026-10-04", method: "PIX" }),
      }),
      { params: Promise.resolve({ id: "c1" }) }
    );

    expect(response.status).toBe(404);
  });
});
