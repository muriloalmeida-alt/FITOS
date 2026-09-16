import { afterEach, describe, expect, it, vi } from "vitest";

const requireStudent = vi.fn();
const findUniqueOrThrow = vi.fn();

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
    "@/modules/tenancy/authContext"
  );
  return {
    ...actual,
    requireStudent: (...args: unknown[]) => requireStudent(...args),
  };
});

vi.mock("@/shared/db/prisma", () => ({
  prisma: { student: { findUniqueOrThrow: (...args: unknown[]) => findUniqueOrThrow(...args) } },
}));

describe("GET /api/tenancy/meu-perfil", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna o perfil do aluno da sessão, ignorando um studentId adulterado na query string", async () => {
    requireStudent.mockResolvedValue({ userId: "u1", role: "ALUNO", tenantId: "t1", studentId: "student-real" });
    findUniqueOrThrow.mockResolvedValue({ id: "student-real", displayName: "Aluno real" });

    const { GET } = await import("./route");
    const request = new Request("http://localhost/api/tenancy/meu-perfil?studentId=student-de-outro-aluno");
    const response = await GET(request);
    const body = await response.json();

    expect(findUniqueOrThrow).toHaveBeenCalledWith({ where: { id: "student-real" } });
    expect(body).toEqual({ id: "student-real", displayName: "Aluno real" });
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
      "@/modules/tenancy/authContext"
    );
    requireStudent.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/tenancy/meu-perfil"));

    expect(response.status).toBe(401);
  });

  it("retorna 403 quando o usuário autenticado não é aluno (ou não tem vínculo)", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
      "@/modules/tenancy/authContext"
    );
    requireStudent.mockRejectedValue(new AuthError("FORBIDDEN", "Acesso restrito a aluno com vínculo ativo."));

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/tenancy/meu-perfil"));

    expect(response.status).toBe(403);
  });
});
