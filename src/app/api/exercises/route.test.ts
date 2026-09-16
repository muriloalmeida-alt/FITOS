import { afterEach, describe, expect, it, vi } from "vitest";

const requirePersonal = vi.fn();
const createOwnExercise = vi.fn();

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
    "@/modules/tenancy/authContext"
  );
  return { ...actual, requirePersonal: (...args: unknown[]) => requirePersonal(...args) };
});

vi.mock("@/modules/exercises/exercises", async () => {
  const actual = await vi.importActual<typeof import("@/modules/exercises/exercises")>("@/modules/exercises/exercises");
  return { ...actual, createOwnExercise: (...args: unknown[]) => createOwnExercise(...args) };
});

describe("POST /api/exercises", () => {
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
      new Request("http://localhost/api/exercises", { method: "POST", body: JSON.stringify({ name: "x" }) })
    );

    expect(response.status).toBe(401);
  });

  it("retorna 403 quando o usuário autenticado é aluno", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
      "@/modules/tenancy/authContext"
    );
    requirePersonal.mockRejectedValue(new AuthError("FORBIDDEN", "Acesso restrito a personal."));

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/exercises", { method: "POST", body: JSON.stringify({ name: "x" }) })
    );

    expect(response.status).toBe(403);
    expect(createOwnExercise).not.toHaveBeenCalled();
  });

  it("cadastra usando o tenantId e userId da sessão, ignora qualquer tenantId enviado no corpo", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    createOwnExercise.mockResolvedValue({ id: "e1", name: "Rosca direta" });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/exercises", {
        method: "POST",
        body: JSON.stringify({ name: "Rosca direta", muscle: "bíceps", tenantId: "tenant-adulterado" }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.name).toBe("Rosca direta");
    expect(createOwnExercise).toHaveBeenCalledWith({
      tenantId: "tenant-real",
      actorUserId: "u1",
      name: "Rosca direta",
      type: undefined,
      muscle: "bíceps",
      equipments: undefined,
      instructions: undefined,
    });
  });

  it("retorna 400 quando o nome não é informado", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/exercises", { method: "POST", body: JSON.stringify({}) }));

    expect(response.status).toBe(400);
    expect(createOwnExercise).not.toHaveBeenCalled();
  });

  it("retorna 400 quando o nome é duplicado no tenant", async () => {
    const { ExerciseError } = await vi.importActual<typeof import("@/modules/exercises/exercises")>(
      "@/modules/exercises/exercises"
    );
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    createOwnExercise.mockRejectedValue(new ExerciseError("NOME_DUPLICADO_NO_TENANT", "Já existe um exercício com este nome."));

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/exercises", { method: "POST", body: JSON.stringify({ name: "Rosca direta" }) })
    );

    expect(response.status).toBe(400);
  });
});
