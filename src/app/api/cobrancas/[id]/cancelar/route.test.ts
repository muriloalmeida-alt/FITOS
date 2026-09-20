import { afterEach, describe, expect, it, vi } from "vitest";

const requirePersonal = vi.fn();
const cancelStudentCharge = vi.fn();

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
  return { ...actual, cancelStudentCharge: (...args: unknown[]) => cancelStudentCharge(...args) };
});

describe("POST /api/cobrancas/[id]/cancelar", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
      "@/modules/tenancy/authContext"
    );
    requirePersonal.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/cobrancas/c1/cancelar", { method: "POST", body: "{}" }), {
      params: Promise.resolve({ id: "c1" }),
    });

    expect(response.status).toBe(401);
  });

  it("cancela usando o tenantId da sessão, nunca do corpo", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    cancelStudentCharge.mockResolvedValue({ id: "c1", status: "CANCELADO" });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/cobrancas/c1/cancelar", {
        method: "POST",
        body: JSON.stringify({ reason: "Aluno saiu", tenantId: "outro-tenant" }),
      }),
      { params: Promise.resolve({ id: "c1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("CANCELADO");
    expect(cancelStudentCharge).toHaveBeenCalledWith({ tenantId: "tenant-real", chargeId: "c1", reason: "Aluno saiu" });
  });

  it("retorna 409 quando a cobrança já está paga", async () => {
    const { StudentChargeError } = await vi.importActual<typeof import("@/modules/student-finance/charges")>(
      "@/modules/student-finance/charges"
    );
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "t1" });
    cancelStudentCharge.mockRejectedValue(new StudentChargeError("ESTADO_INVALIDO", "Uma cobrança já paga não pode ser cancelada."));

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/cobrancas/c1/cancelar", { method: "POST", body: JSON.stringify({ reason: "motivo" }) }),
      { params: Promise.resolve({ id: "c1" }) }
    );

    expect(response.status).toBe(409);
  });

  it("retorna 404 quando a cobrança não pertence ao tenant da sessão", async () => {
    const { StudentChargeError } = await vi.importActual<typeof import("@/modules/student-finance/charges")>(
      "@/modules/student-finance/charges"
    );
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "t1" });
    cancelStudentCharge.mockRejectedValue(new StudentChargeError("NAO_ENCONTRADO", "Cobrança não encontrada."));

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/cobrancas/c1/cancelar", { method: "POST", body: JSON.stringify({ reason: "motivo" }) }),
      { params: Promise.resolve({ id: "c1" }) }
    );

    expect(response.status).toBe(404);
  });
});
