import { afterEach, describe, expect, it, vi } from "vitest";

const requirePersonal = vi.fn();
const createStudentCharge = vi.fn();
const listChargesForStudent = vi.fn();

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
  return {
    ...actual,
    createStudentCharge: (...args: unknown[]) => createStudentCharge(...args),
    listChargesForStudent: (...args: unknown[]) => listChargesForStudent(...args),
  };
});

describe("POST /api/students/[id]/cobrancas", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
      "@/modules/tenancy/authContext"
    );
    requirePersonal.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/students/s1/cobrancas", { method: "POST", body: "{}" }), {
      params: Promise.resolve({ id: "s1" }),
    });

    expect(response.status).toBe(401);
  });

  it("retorna 400 quando o valor não é um número", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "t1" });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/students/s1/cobrancas", {
        method: "POST",
        body: JSON.stringify({ description: "Mensalidade", amountReais: "abc", referenceMonth: "2026-10-01", dueDate: "2026-10-05" }),
      }),
      { params: Promise.resolve({ id: "s1" }) }
    );

    expect(response.status).toBe(400);
    expect(createStudentCharge).not.toHaveBeenCalled();
  });

  it("cria usando o tenantId da sessão, nunca do corpo", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    createStudentCharge.mockResolvedValue({ id: "c1", amountCents: 15000 });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/students/s1/cobrancas", {
        method: "POST",
        body: JSON.stringify({
          description: "Mensalidade outubro",
          amountReais: 150,
          referenceMonth: "2026-10-15",
          dueDate: "2026-10-05",
          tenantId: "outro-tenant",
        }),
      }),
      { params: Promise.resolve({ id: "s1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.amountCents).toBe(15000);
    const call = createStudentCharge.mock.calls[0]![0];
    expect(call.tenantId).toBe("tenant-real");
    expect(call.studentId).toBe("s1");
    expect(call.description).toBe("Mensalidade outubro");
    expect(call.amountReais).toBe(150);
  });

  it("retorna 404 quando o aluno não pertence ao tenant da sessão", async () => {
    const { StudentChargeError } = await vi.importActual<typeof import("@/modules/student-finance/charges")>(
      "@/modules/student-finance/charges"
    );
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "t1" });
    createStudentCharge.mockRejectedValue(new StudentChargeError("NAO_ENCONTRADO", "Aluno não encontrado."));

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/students/s1/cobrancas", {
        method: "POST",
        body: JSON.stringify({ description: "Mensalidade", amountReais: 100, referenceMonth: "2026-10-01", dueDate: "2026-10-05" }),
      }),
      { params: Promise.resolve({ id: "s1" }) }
    );

    expect(response.status).toBe(404);
  });
});

describe("GET /api/students/[id]/cobrancas", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
      "@/modules/tenancy/authContext"
    );
    requirePersonal.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/students/s1/cobrancas"), { params: Promise.resolve({ id: "s1" }) });

    expect(response.status).toBe(401);
  });

  it("lista usando o tenantId da sessão", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    listChargesForStudent.mockResolvedValue([{ id: "c1" }]);

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/students/s1/cobrancas"), { params: Promise.resolve({ id: "s1" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([{ id: "c1" }]);
    expect(listChargesForStudent).toHaveBeenCalledWith({ tenantId: "tenant-real", studentId: "s1" });
  });
});
