import { afterEach, describe, expect, it, vi } from "vitest";

const requirePersonal = vi.fn();
const generateInvitation = vi.fn();
const cancelInvitation = vi.fn();

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
    "@/modules/tenancy/authContext"
  );
  return { ...actual, requirePersonal: (...args: unknown[]) => requirePersonal(...args) };
});

vi.mock("@/modules/students/invitations", async () => {
  const actual = await vi.importActual<typeof import("@/modules/students/invitations")>(
    "@/modules/students/invitations"
  );
  return {
    ...actual,
    generateInvitation: (...args: unknown[]) => generateInvitation(...args),
    cancelInvitation: (...args: unknown[]) => cancelInvitation(...args),
  };
});

function makeParams(id: string) {
  return Promise.resolve({ id });
}

describe("POST /api/students/[id]/convite", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
      "@/modules/tenancy/authContext"
    );
    requirePersonal.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/students/s1/convite", { method: "POST" }), {
      params: makeParams("s1"),
    });

    expect(response.status).toBe(401);
  });

  it("gera o convite usando o tenantId/userId da sessão e retorna o link com o token bruto", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    generateInvitation.mockResolvedValue({
      invitation: { id: "inv1", expiresAt: new Date("2026-09-23T00:00:00Z") },
      rawToken: "token-bruto-nunca-logado",
    });

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/students/s1/convite", { method: "POST" }), {
      params: makeParams("s1"),
    });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.link).toContain("token-bruto-nunca-logado");
    expect(generateInvitation).toHaveBeenCalledWith({ tenantId: "tenant-real", studentId: "s1", actorUserId: "u1" });
  });

  it("retorna 400 quando o domínio rejeita (ex.: aluno inativo)", async () => {
    const { InvitationError } = await vi.importActual<typeof import("@/modules/students/invitations")>(
      "@/modules/students/invitations"
    );
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    generateInvitation.mockRejectedValue(new InvitationError("ALUNO_INATIVO", "Não é possível convidar um aluno inativo."));

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/students/s1/convite", { method: "POST" }), {
      params: makeParams("s1"),
    });

    expect(response.status).toBe(400);
  });
});

describe("DELETE /api/students/[id]/convite", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
      "@/modules/tenancy/authContext"
    );
    requirePersonal.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { DELETE } = await import("./route");
    const response = await DELETE(new Request("http://localhost/api/students/s1/convite", { method: "DELETE" }), {
      params: makeParams("s1"),
    });

    expect(response.status).toBe(401);
  });

  it("cancela usando o tenantId/userId da sessão", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    cancelInvitation.mockResolvedValue(undefined);

    const { DELETE } = await import("./route");
    const response = await DELETE(new Request("http://localhost/api/students/s1/convite", { method: "DELETE" }), {
      params: makeParams("s1"),
    });

    expect(response.status).toBe(200);
    expect(cancelInvitation).toHaveBeenCalledWith({ tenantId: "tenant-real", studentId: "s1", actorUserId: "u1" });
  });
});
