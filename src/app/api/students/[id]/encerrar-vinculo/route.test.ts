import { afterEach, describe, expect, it, vi } from "vitest";

const requirePersonal = vi.fn();
const endStudentBond = vi.fn();

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requirePersonal: (...args: unknown[]) => requirePersonal(...args) };
});

vi.mock("@/modules/students/students", async () => {
  const actual = await vi.importActual<typeof import("@/modules/students/students")>("@/modules/students/students");
  return { ...actual, endStudentBond: (...args: unknown[]) => endStudentBond(...args) };
});

describe("POST /api/students/[id]/encerrar-vinculo (FIT-106)", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requirePersonal.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/students/s1/encerrar-vinculo", { method: "POST" }), {
      params: Promise.resolve({ id: "s1" }),
    });

    expect(response.status).toBe(401);
  });

  it("encerra usando o tenantId da sessão e passa o motivo informado", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    endStudentBond.mockResolvedValue({ id: "s1", status: "VINCULO_ENCERRADO" });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/students/s1/encerrar-vinculo", {
        method: "POST",
        body: JSON.stringify({ reason: "Mudança de cidade" }),
      }),
      { params: Promise.resolve({ id: "s1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("VINCULO_ENCERRADO");
    expect(endStudentBond).toHaveBeenCalledWith({
      tenantId: "tenant-real",
      studentId: "s1",
      actorUserId: "u1",
      reason: "Mudança de cidade",
    });
  });

  it("aceita corpo vazio, passando reason null", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "t1" });
    endStudentBond.mockResolvedValue({ id: "s1", status: "VINCULO_ENCERRADO" });

    const { POST } = await import("./route");
    await POST(new Request("http://localhost/api/students/s1/encerrar-vinculo", { method: "POST" }), {
      params: Promise.resolve({ id: "s1" }),
    });

    expect(endStudentBond).toHaveBeenCalledWith({ tenantId: "t1", studentId: "s1", actorUserId: "u1", reason: null });
  });

  it("retorna 404 quando o aluno não pertence ao personal", async () => {
    const { StudentError } = await vi.importActual<typeof import("@/modules/students/students")>("@/modules/students/students");
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "t1" });
    endStudentBond.mockRejectedValue(new StudentError("NAO_ENCONTRADO", "Aluno não encontrado."));

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/students/s1/encerrar-vinculo", { method: "POST" }), {
      params: Promise.resolve({ id: "s1" }),
    });

    expect(response.status).toBe(404);
  });

  it("retorna 400 quando StudentError de validação é lançado", async () => {
    const { StudentError } = await vi.importActual<typeof import("@/modules/students/students")>("@/modules/students/students");
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "t1" });
    endStudentBond.mockRejectedValue(new StudentError("VALIDACAO", "O motivo deve ter no máximo 500 caracteres."));

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/students/s1/encerrar-vinculo", { method: "POST", body: JSON.stringify({ reason: "x".repeat(501) }) }),
      { params: Promise.resolve({ id: "s1" }) }
    );

    expect(response.status).toBe(400);
  });
});
