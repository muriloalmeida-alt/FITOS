import { afterEach, describe, expect, it, vi } from "vitest";

const requirePersonal = vi.fn();
const generateMonthChargesForRecurrences = vi.fn();

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requirePersonal: (...args: unknown[]) => requirePersonal(...args) };
});

vi.mock("@/modules/student-finance/charges", async () => {
  const actual = await vi.importActual<typeof import("@/modules/student-finance/charges")>("@/modules/student-finance/charges");
  return { ...actual, generateMonthChargesForRecurrences: (...args: unknown[]) => generateMonthChargesForRecurrences(...args) };
});

const post = (body: unknown) => new Request("http://localhost/api/recorrencias/gerar-mes", { method: "POST", body: JSON.stringify(body) });

describe("POST /api/recorrencias/gerar-mes (FIT-148, BK-09)", () => {
  afterEach(() => vi.resetAllMocks());

  it("401 sem sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requirePersonal.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));
    const { POST } = await import("./route");
    expect((await POST(post({ referenceMonth: "2026-10" }))).status).toBe(401);
  });

  it("gera a competência pedida no tenant da sessão", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "t1" });
    generateMonthChargesForRecurrences.mockResolvedValue({ created: 3, existing: 1 });
    const { POST } = await import("./route");
    const response = await POST(post({ referenceMonth: "2026-10" }));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ created: 3, existing: 1 });
    expect(generateMonthChargesForRecurrences).toHaveBeenCalledWith({ tenantId: "t1", referenceMonth: new Date(Date.UTC(2026, 9, 1)) });
  });

  it("400 sem competência", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "t1" });
    const { POST } = await import("./route");
    expect((await POST(post({}))).status).toBe(400);
  });
});
