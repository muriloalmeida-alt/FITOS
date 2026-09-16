import { afterEach, describe, expect, it, vi } from "vitest";

const requirePersonal = vi.fn();
const createStudent = vi.fn();
const listStudents = vi.fn();

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
    "@/modules/tenancy/authContext"
  );
  return {
    ...actual,
    requirePersonal: (...args: unknown[]) => requirePersonal(...args),
  };
});

vi.mock("@/modules/students/students", async () => {
  const actual = await vi.importActual<typeof import("@/modules/students/students")>("@/modules/students/students");
  return {
    ...actual,
    createStudent: (...args: unknown[]) => createStudent(...args),
    listStudents: (...args: unknown[]) => listStudents(...args),
  };
});

describe("GET /api/students", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
      "@/modules/tenancy/authContext"
    );
    requirePersonal.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/students"));

    expect(response.status).toBe(401);
  });

  it("retorna 403 quando o usuário autenticado não é personal", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
      "@/modules/tenancy/authContext"
    );
    requirePersonal.mockRejectedValue(new AuthError("FORBIDDEN", "Acesso restrito a personal."));

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/students"));

    expect(response.status).toBe(403);
  });

  it("usa o tenantId da sessão, ignorando qualquer tenantId adulterado na query string", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    listStudents.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/students?tenantId=tenant-de-outro-personal&q=joana"));
    await response.json();

    expect(listStudents).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "tenant-real", search: "joana" })
    );
  });

  it("ignora valores inválidos de status/sort/page/pageSize, sem quebrar", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    listStudents.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/students?status=NAO_EXISTE&sort=aleatorio&page=abc"));

    expect(response.status).toBe(200);
    expect(listStudents).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "tenant-real", status: undefined, sort: undefined })
    );
  });
});

describe("POST /api/students", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
      "@/modules/tenancy/authContext"
    );
    requirePersonal.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/students", { method: "POST", body: JSON.stringify({ name: "A", email: "a@example.test" }) })
    );

    expect(response.status).toBe(401);
  });

  it("cadastra usando o tenantId da sessão, ignorando qualquer tenantId enviado no corpo", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    createStudent.mockResolvedValue({ id: "s1", tenantId: "tenant-real", email: "aluno@example.test", displayName: "Aluno" });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/students", {
        method: "POST",
        body: JSON.stringify({ name: "Aluno", email: "aluno@example.test", tenantId: "tenant-adulterado" }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.tenantId).toBe("tenant-real");
    expect(createStudent).toHaveBeenCalledWith({ tenantId: "tenant-real", name: "Aluno", email: "aluno@example.test" });
  });

  it("retorna 400 quando faltam campos obrigatórios", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/students", { method: "POST", body: JSON.stringify({}) }));

    expect(response.status).toBe(400);
    expect(createStudent).not.toHaveBeenCalled();
  });

  it("retorna 400 com o motivo quando o domínio rejeita (ex.: e-mail duplicado)", async () => {
    const { StudentError } = await vi.importActual<typeof import("@/modules/students/students")>(
      "@/modules/students/students"
    );
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    createStudent.mockRejectedValue(new StudentError("EMAIL_DUPLICADO_NO_TENANT", "Já existe um aluno com este e-mail na sua carteira."));

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/students", { method: "POST", body: JSON.stringify({ name: "A", email: "a@example.test" }) })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("EMAIL_DUPLICADO_NO_TENANT");
  });
});
