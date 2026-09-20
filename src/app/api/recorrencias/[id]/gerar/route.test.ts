import { afterEach, describe, expect, it, vi } from "vitest";

const requirePersonal = vi.fn();
const generateNextChargeForRecurrence = vi.fn();

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
  return { ...actual, generateNextChargeForRecurrence: (...args: unknown[]) => generateNextChargeForRecurrence(...args) };
});

describe("POST /api/recorrencias/[id]/gerar", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
      "@/modules/tenancy/authContext"
    );
    requirePersonal.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/recorrencias/r1/gerar", { method: "POST" }), {
      params: Promise.resolve({ id: "r1" }),
    });

    expect(response.status).toBe(401);
  });

  it("gera usando o tenantId da sessão", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    generateNextChargeForRecurrence.mockResolvedValue({ id: "c1", status: "PENDENTE" });

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/recorrencias/r1/gerar", { method: "POST" }), {
      params: Promise.resolve({ id: "r1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.status).toBe("PENDENTE");
    expect(generateNextChargeForRecurrence).toHaveBeenCalledWith({ tenantId: "tenant-real", recurrenceId: "r1" });
  });

  it("retorna 409 quando a recorrência está encerrada", async () => {
    const { StudentChargeError } = await vi.importActual<typeof import("@/modules/student-finance/charges")>(
      "@/modules/student-finance/charges"
    );
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "t1" });
    generateNextChargeForRecurrence.mockRejectedValue(
      new StudentChargeError("ESTADO_INVALIDO", "Uma recorrência encerrada não gera novas cobranças.")
    );

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/recorrencias/r1/gerar", { method: "POST" }), {
      params: Promise.resolve({ id: "r1" }),
    });

    expect(response.status).toBe(409);
  });

  it("retorna 404 quando a recorrência não pertence ao tenant da sessão", async () => {
    const { StudentChargeError } = await vi.importActual<typeof import("@/modules/student-finance/charges")>(
      "@/modules/student-finance/charges"
    );
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "t1" });
    generateNextChargeForRecurrence.mockRejectedValue(new StudentChargeError("NAO_ENCONTRADO", "Recorrência não encontrada."));

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/recorrencias/r1/gerar", { method: "POST" }), {
      params: Promise.resolve({ id: "r1" }),
    });

    expect(response.status).toBe(404);
  });
});
