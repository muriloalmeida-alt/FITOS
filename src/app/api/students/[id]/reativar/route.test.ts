import { afterEach, describe, expect, it, vi } from "vitest";

const requirePersonal = vi.fn();
const reactivateStudent = vi.fn();

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
    "@/modules/tenancy/authContext"
  );
  return { ...actual, requirePersonal: (...args: unknown[]) => requirePersonal(...args) };
});

vi.mock("@/modules/students/students", async () => {
  const actual = await vi.importActual<typeof import("@/modules/students/students")>("@/modules/students/students");
  return { ...actual, reactivateStudent: (...args: unknown[]) => reactivateStudent(...args) };
});

describe("POST /api/students/[id]/reativar", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
      "@/modules/tenancy/authContext"
    );
    requirePersonal.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/students/s1/reativar", { method: "POST" }), {
      params: Promise.resolve({ id: "s1" }),
    });

    expect(response.status).toBe(401);
  });

  it("reativa usando o tenantId e userId da sessão", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    reactivateStudent.mockResolvedValue({ id: "s1", status: "ATIVO" });

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/students/s1/reativar", { method: "POST" }), {
      params: Promise.resolve({ id: "s1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ATIVO");
    expect(reactivateStudent).toHaveBeenCalledWith({ tenantId: "tenant-real", studentId: "s1", actorUserId: "u1" });
  });
});
