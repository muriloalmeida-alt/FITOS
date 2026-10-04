import { afterEach, describe, expect, it, vi } from "vitest";

const requireSession = vi.fn();
const joinPersonalWithInvitation = vi.fn();

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requireSession: (...args: unknown[]) => requireSession(...args) };
});
vi.mock("@/modules/identity/studentAccount", async () => {
  const actual = await vi.importActual<typeof import("@/modules/identity/studentAccount")>("@/modules/identity/studentAccount");
  return { ...actual, joinPersonalWithInvitation: (...args: unknown[]) => joinPersonalWithInvitation(...args) };
});

const post = (body: unknown) => new Request("http://localhost/api/minha-conta/convite", { method: "POST", body: JSON.stringify(body) });

describe("POST /api/minha-conta/convite (FIT-151)", () => {
  afterEach(() => vi.resetAllMocks());

  it("usa o usuário da sessão, nunca um id do corpo", async () => {
    requireSession.mockResolvedValue({ authenticated: true, userId: "u1", role: "ALUNO", tenantId: null, studentId: null });
    joinPersonalWithInvitation.mockResolvedValue({ studentId: "s1", tenantId: "t1" });
    const { POST } = await import("./route");
    const response = await POST(post({ code: "abc", userId: "outro" }));
    expect(response.status).toBe(200);
    expect(joinPersonalWithInvitation).toHaveBeenCalledWith({ userId: "u1", code: "abc" });
  });

  it("código inválido é 400 e aluno já vinculado é 409", async () => {
    requireSession.mockResolvedValue({ authenticated: true, userId: "u1", role: "ALUNO", tenantId: null, studentId: null });
    const { StudentAccountError } = await vi.importActual<typeof import("@/modules/identity/studentAccount")>("@/modules/identity/studentAccount");
    const { POST } = await import("./route");
    joinPersonalWithInvitation.mockRejectedValueOnce(new StudentAccountError("CODIGO_INVALIDO", "x"));
    expect((await POST(post({ code: "x" }))).status).toBe(400);
    joinPersonalWithInvitation.mockRejectedValueOnce(new StudentAccountError("JA_VINCULADO", "y"));
    expect((await POST(post({ code: "x" }))).status).toBe(409);
  });

  it("401 sem sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requireSession.mockRejectedValue(new AuthError("UNAUTHENTICATED", "x"));
    const { POST } = await import("./route");
    expect((await POST(post({ code: "x" }))).status).toBe(401);
  });
});
