import { afterEach, describe, expect, it, vi } from "vitest";

const requirePersonal = vi.fn();
const createChargeWithOptionalRecurrence = vi.fn();

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requirePersonal: (...args: unknown[]) => requirePersonal(...args) };
});

vi.mock("@/modules/student-finance/charges", async () => {
  const actual = await vi.importActual<typeof import("@/modules/student-finance/charges")>("@/modules/student-finance/charges");
  return { ...actual, createChargeWithOptionalRecurrence: (...args: unknown[]) => createChargeWithOptionalRecurrence(...args) };
});

const post = (body: unknown) => new Request("http://localhost/api/cobrancas", { method: "POST", body: JSON.stringify(body) });

describe("POST /api/cobrancas (FIT-148, BK-10)", () => {
  afterEach(() => vi.resetAllMocks());

  it("cria com o tenant da sessão e o mês pedido", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "t1" });
    createChargeWithOptionalRecurrence.mockResolvedValue({ charge: { id: "c1" }, recurrence: { id: "r1" } });
    const { POST } = await import("./route");
    const response = await POST(post({ studentId: "s1", amountReais: 180, referenceMonth: "2026-10", dueDayOfMonth: 5, description: "Mensalidade", repeatMonthly: true, tenantId: "outro" }));
    expect(response.status).toBe(201);
    expect(createChargeWithOptionalRecurrence).toHaveBeenCalledWith({
      tenantId: "t1",
      studentId: "s1",
      description: "Mensalidade",
      amountReais: 180,
      referenceMonth: new Date(Date.UTC(2026, 9, 1)),
      dueDayOfMonth: 5,
      repeatMonthly: true,
    });
  });

  it("400 com competência inválida, sem chamar o módulo", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "t1" });
    const { POST } = await import("./route");
    const response = await POST(post({ studentId: "s1", amountReais: 180, referenceMonth: "outubro", dueDayOfMonth: 5 }));
    expect(response.status).toBe(400);
    expect(createChargeWithOptionalRecurrence).not.toHaveBeenCalled();
  });

  it("aluno de outro tenant é 404", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "t1" });
    const { StudentChargeError } = await vi.importActual<typeof import("@/modules/student-finance/charges")>("@/modules/student-finance/charges");
    createChargeWithOptionalRecurrence.mockRejectedValue(new StudentChargeError("NAO_ENCONTRADO", "Aluno não encontrado."));
    const { POST } = await import("./route");
    const response = await POST(post({ studentId: "alheio", amountReais: 180, referenceMonth: "2026-10", dueDayOfMonth: 5, description: "M" }));
    expect(response.status).toBe(404);
  });
});
