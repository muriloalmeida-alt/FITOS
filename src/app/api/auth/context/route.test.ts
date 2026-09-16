import { afterEach, describe, expect, it, vi } from "vitest";

const getAuthContext = vi.fn();

vi.mock("@/modules/tenancy/authContext", () => ({
  getAuthContext: (...args: unknown[]) => getAuthContext(...args),
}));

describe("GET /api/auth/context", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 401 quando não há sessão", async () => {
    getAuthContext.mockResolvedValue({ authenticated: false });
    const { GET } = await import("./route");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ authenticated: false });
  });

  it("retorna o papel, tenantId e studentId do personal autenticado", async () => {
    getAuthContext.mockResolvedValue({
      authenticated: true,
      userId: "u1",
      role: "PERSONAL",
      tenantId: "t1",
      studentId: null,
    });
    const { GET } = await import("./route");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ authenticated: true, role: "PERSONAL", tenantId: "t1", studentId: null });
  });

  it("retorna o papel, tenantId e studentId do aluno autenticado", async () => {
    getAuthContext.mockResolvedValue({
      authenticated: true,
      userId: "u2",
      role: "ALUNO",
      tenantId: "t1",
      studentId: "s1",
    });
    const { GET } = await import("./route");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ authenticated: true, role: "ALUNO", tenantId: "t1", studentId: "s1" });
  });
});
