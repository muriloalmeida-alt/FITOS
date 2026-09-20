import { afterEach, describe, expect, it, vi } from "vitest";

const requirePersonal = vi.fn();
const endChargeRecurrence = vi.fn();

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
  return { ...actual, endChargeRecurrence: (...args: unknown[]) => endChargeRecurrence(...args) };
});

describe("POST /api/recorrencias/[id]/encerrar", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
      "@/modules/tenancy/authContext"
    );
    requirePersonal.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/recorrencias/r1/encerrar", { method: "POST" }), {
      params: Promise.resolve({ id: "r1" }),
    });

    expect(response.status).toBe(401);
  });

  it("encerra usando o tenantId da sessão", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    endChargeRecurrence.mockResolvedValue({ id: "r1", status: "ENCERRADA" });

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/recorrencias/r1/encerrar", { method: "POST" }), {
      params: Promise.resolve({ id: "r1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ENCERRADA");
    expect(endChargeRecurrence).toHaveBeenCalledWith({ tenantId: "tenant-real", recurrenceId: "r1" });
  });

  it("retorna 404 quando a recorrência não pertence ao tenant da sessão", async () => {
    const { StudentChargeError } = await vi.importActual<typeof import("@/modules/student-finance/charges")>(
      "@/modules/student-finance/charges"
    );
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "t1" });
    endChargeRecurrence.mockRejectedValue(new StudentChargeError("NAO_ENCONTRADO", "Recorrência não encontrada."));

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/recorrencias/r1/encerrar", { method: "POST" }), {
      params: Promise.resolve({ id: "r1" }),
    });

    expect(response.status).toBe(404);
  });
});
