import { afterEach, describe, expect, it, vi } from "vitest";

const requireSession = vi.fn();
const updateOwnName = vi.fn();
const changeOwnEmail = vi.fn();

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requireSession: (...args: unknown[]) => requireSession(...args) };
});
vi.mock("@/modules/identity/ownAccount", async () => {
  const actual = await vi.importActual<typeof import("@/modules/identity/ownAccount")>("@/modules/identity/ownAccount");
  return { ...actual, updateOwnName: (...args: unknown[]) => updateOwnName(...args), changeOwnEmail: (...args: unknown[]) => changeOwnEmail(...args) };
});

describe("/api/minha-conta (FIT-155)", () => {
  afterEach(() => vi.resetAllMocks());

  it("nome e e-mail sempre do usuário da sessão", async () => {
    requireSession.mockResolvedValue({ authenticated: true, userId: "u1", role: "ALUNO", tenantId: "t1", studentId: "s1" });
    const { PATCH } = await import("./route");
    const { POST } = await import("./email/route");
    expect((await PATCH(new Request("http://x", { method: "PATCH", body: JSON.stringify({ name: "Pedro", userId: "outro" }) }))).status).toBe(204);
    expect(updateOwnName).toHaveBeenCalledWith({ userId: "u1", name: "Pedro" });
    expect((await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ email: "a@b.co", password: "x" }) }))).status).toBe(204);
    expect(changeOwnEmail).toHaveBeenCalledWith({ userId: "u1", email: "a@b.co", password: "x" });
  });

  it("senha errada é 403 e e-mail em uso é 409", async () => {
    requireSession.mockResolvedValue({ authenticated: true, userId: "u1", role: "ALUNO", tenantId: "t1", studentId: "s1" });
    const { OwnAccountError } = await vi.importActual<typeof import("@/modules/identity/ownAccount")>("@/modules/identity/ownAccount");
    const { POST } = await import("./email/route");
    changeOwnEmail.mockRejectedValueOnce(new OwnAccountError("SENHA_INCORRETA", "Senha incorreta."));
    expect((await POST(new Request("http://x", { method: "POST", body: "{}" }))).status).toBe(403);
    changeOwnEmail.mockRejectedValueOnce(new OwnAccountError("EMAIL_EM_USO", "x"));
    expect((await POST(new Request("http://x", { method: "POST", body: "{}" }))).status).toBe(409);
  });
});
