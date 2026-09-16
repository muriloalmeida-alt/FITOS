import { afterEach, describe, expect, it, vi } from "vitest";

const requirePersonal = vi.fn();
const updateStudent = vi.fn();

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
    "@/modules/tenancy/authContext"
  );
  return { ...actual, requirePersonal: (...args: unknown[]) => requirePersonal(...args) };
});

vi.mock("@/modules/students/students", async () => {
  const actual = await vi.importActual<typeof import("@/modules/students/students")>("@/modules/students/students");
  return { ...actual, updateStudent: (...args: unknown[]) => updateStudent(...args) };
});

function makeParams(id: string) {
  return Promise.resolve({ id });
}

describe("PATCH /api/students/[id]", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
      "@/modules/tenancy/authContext"
    );
    requirePersonal.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { PATCH } = await import("./route");
    const response = await PATCH(new Request("http://localhost/api/students/s1", { method: "PATCH", body: "{}" }), {
      params: makeParams("s1"),
    });

    expect(response.status).toBe(401);
  });

  it("usa o tenantId da sessão, ignorando qualquer tenantId no corpo", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    updateStudent.mockResolvedValue({ id: "s1", displayName: "Novo Nome" });

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/students/s1", {
        method: "PATCH",
        body: JSON.stringify({ name: "Novo Nome", tenantId: "tenant-adulterado" }),
      }),
      { params: makeParams("s1") }
    );

    expect(response.status).toBe(200);
    expect(updateStudent).toHaveBeenCalledWith({
      tenantId: "tenant-real",
      studentId: "s1",
      actorUserId: "u1",
      name: "Novo Nome",
      email: undefined,
    });
  });

  it("retorna 404 quando o domínio não encontra o aluno (outro tenant)", async () => {
    const { StudentError } = await vi.importActual<typeof import("@/modules/students/students")>(
      "@/modules/students/students"
    );
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    updateStudent.mockRejectedValue(new StudentError("NAO_ENCONTRADO", "Aluno não encontrado."));

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/students/s1", { method: "PATCH", body: JSON.stringify({ name: "X" }) }),
      { params: makeParams("s1") }
    );

    expect(response.status).toBe(404);
  });

  it("retorna 400 quando o domínio bloqueia a troca de e-mail pós-ativação", async () => {
    const { StudentError } = await vi.importActual<typeof import("@/modules/students/students")>(
      "@/modules/students/students"
    );
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    updateStudent.mockRejectedValue(
      new StudentError("EMAIL_BLOQUEADO_POS_ATIVACAO", "Este aluno já ativou a conta — o e-mail não pode ser alterado por aqui.")
    );

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/students/s1", { method: "PATCH", body: JSON.stringify({ email: "novo@example.test" }) }),
      { params: makeParams("s1") }
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("EMAIL_BLOQUEADO_POS_ATIVACAO");
  });
});
