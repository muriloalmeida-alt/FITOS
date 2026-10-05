import { afterEach, describe, expect, it, vi } from "vitest";

const requireSession = vi.fn();
const switchToIndividual = vi.fn();

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requireSession: (...args: unknown[]) => requireSession(...args) };
});
vi.mock("@/modules/identity/studentAccount", async () => {
  const actual = await vi.importActual<typeof import("@/modules/identity/studentAccount")>("@/modules/identity/studentAccount");
  return { ...actual, switchToIndividual: (...args: unknown[]) => switchToIndividual(...args) };
});

describe("POST /api/minha-conta/treinar-sozinho (FIT-151)", () => {
  afterEach(() => vi.resetAllMocks());

  it("converte a conta da sessão e indica o onboarding do Livre", async () => {
    requireSession.mockResolvedValue({ authenticated: true, userId: "u1", role: "ALUNO", tenantId: null, studentId: null });
    const { POST } = await import("./route");
    const response = await POST();
    expect(await response.json()).toEqual({ ok: true, redirectTo: "/onboarding" });
    expect(switchToIndividual).toHaveBeenCalledWith({ userId: "u1" });
  });

  it("aluno ativo recebe 409", async () => {
    requireSession.mockResolvedValue({ authenticated: true, userId: "u1", role: "ALUNO", tenantId: "t1", studentId: "s1" });
    const { StudentAccountError } = await vi.importActual<typeof import("@/modules/identity/studentAccount")>("@/modules/identity/studentAccount");
    switchToIndividual.mockRejectedValue(new StudentAccountError("JA_VINCULADO", "x"));
    const { POST } = await import("./route");
    expect((await POST()).status).toBe(409);
  });
});
