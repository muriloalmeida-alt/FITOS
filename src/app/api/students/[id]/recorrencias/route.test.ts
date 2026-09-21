import { afterEach, describe, expect, it, vi } from "vitest";

const requirePersonal = vi.fn();
const createChargeRecurrence = vi.fn();

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
  return { ...actual, createChargeRecurrence: (...args: unknown[]) => createChargeRecurrence(...args) };
});

describe("POST /api/students/[id]/recorrencias", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
      "@/modules/tenancy/authContext"
    );
    requirePersonal.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/students/s1/recorrencias", { method: "POST", body: "{}" }), {
      params: Promise.resolve({ id: "s1" }),
    });

    expect(response.status).toBe(401);
  });

  it("retorna 400 quando valor ou dia de vencimento não são números", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "t1" });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/students/s1/recorrencias", {
        method: "POST",
        body: JSON.stringify({ description: "Mensalidade", amountReais: "abc", dueDayOfMonth: 5 }),
      }),
      { params: Promise.resolve({ id: "s1" }) }
    );

    expect(response.status).toBe(400);
    expect(createChargeRecurrence).not.toHaveBeenCalled();
  });

  it("cria usando o tenantId da sessão, nunca do corpo", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    createChargeRecurrence.mockResolvedValue({ id: "r1", status: "ATIVA" });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/students/s1/recorrencias", {
        method: "POST",
        body: JSON.stringify({ description: "Mensalidade", amountReais: 150, dueDayOfMonth: 5, tenantId: "outro-tenant" }),
      }),
      { params: Promise.resolve({ id: "s1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.status).toBe("ATIVA");
    const call = createChargeRecurrence.mock.calls[0]![0];
    expect(call.tenantId).toBe("tenant-real");
    expect(call.studentId).toBe("s1");
  });

  it("retorna 404 quando o aluno não pertence ao tenant da sessão", async () => {
    const { StudentChargeError } = await vi.importActual<typeof import("@/modules/student-finance/charges")>(
      "@/modules/student-finance/charges"
    );
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "t1" });
    createChargeRecurrence.mockRejectedValue(new StudentChargeError("NAO_ENCONTRADO", "Aluno não encontrado."));

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/students/s1/recorrencias", {
        method: "POST",
        body: JSON.stringify({ description: "Mensalidade", amountReais: 150, dueDayOfMonth: 5 }),
      }),
      { params: Promise.resolve({ id: "s1" }) }
    );

    expect(response.status).toBe(404);
  });
});
