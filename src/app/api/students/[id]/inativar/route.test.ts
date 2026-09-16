import { afterEach, describe, expect, it, vi } from "vitest";

const requirePersonal = vi.fn();
const inactivateStudent = vi.fn();

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
    "@/modules/tenancy/authContext"
  );
  return { ...actual, requirePersonal: (...args: unknown[]) => requirePersonal(...args) };
});

vi.mock("@/modules/students/students", async () => {
  const actual = await vi.importActual<typeof import("@/modules/students/students")>("@/modules/students/students");
  return { ...actual, inactivateStudent: (...args: unknown[]) => inactivateStudent(...args) };
});

describe("POST /api/students/[id]/inativar", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
      "@/modules/tenancy/authContext"
    );
    requirePersonal.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/students/s1/inativar", { method: "POST" }), {
      params: Promise.resolve({ id: "s1" }),
    });

    expect(response.status).toBe(401);
  });

  it("inativa usando o tenantId e userId da sessão", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    inactivateStudent.mockResolvedValue({ id: "s1", status: "INATIVO" });

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/students/s1/inativar", { method: "POST" }), {
      params: Promise.resolve({ id: "s1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("INATIVO");
    expect(inactivateStudent).toHaveBeenCalledWith({ tenantId: "tenant-real", studentId: "s1", actorUserId: "u1" });
  });

  it("retorna 404 quando o aluno não pertence ao tenant da sessão", async () => {
    const { StudentError } = await vi.importActual<typeof import("@/modules/students/students")>(
      "@/modules/students/students"
    );
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    inactivateStudent.mockRejectedValue(new StudentError("NAO_ENCONTRADO", "Aluno não encontrado."));

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/students/s1/inativar", { method: "POST" }), {
      params: Promise.resolve({ id: "s1" }),
    });

    expect(response.status).toBe(404);
  });
});
