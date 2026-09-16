import { afterEach, describe, expect, it, vi } from "vitest";

const requirePersonal = vi.fn();
const reactivateExercise = vi.fn();

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
    "@/modules/tenancy/authContext"
  );
  return { ...actual, requirePersonal: (...args: unknown[]) => requirePersonal(...args) };
});

vi.mock("@/modules/exercises/exercises", async () => {
  const actual = await vi.importActual<typeof import("@/modules/exercises/exercises")>("@/modules/exercises/exercises");
  return { ...actual, reactivateExercise: (...args: unknown[]) => reactivateExercise(...args) };
});

describe("POST /api/exercises/[id]/reativar", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
      "@/modules/tenancy/authContext"
    );
    requirePersonal.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/exercises/e1/reativar", { method: "POST" }), {
      params: Promise.resolve({ id: "e1" }),
    });

    expect(response.status).toBe(401);
  });

  it("reativa usando o tenantId e userId da sessão", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    reactivateExercise.mockResolvedValue({ id: "e1", status: "ATIVO" });

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/exercises/e1/reativar", { method: "POST" }), {
      params: Promise.resolve({ id: "e1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ATIVO");
    expect(reactivateExercise).toHaveBeenCalledWith({ tenantId: "tenant-real", exerciseId: "e1", actorUserId: "u1" });
  });

  it("retorna 404 quando o exercício não pertence ao tenant da sessão", async () => {
    const { ExerciseError } = await vi.importActual<typeof import("@/modules/exercises/exercises")>(
      "@/modules/exercises/exercises"
    );
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    reactivateExercise.mockRejectedValue(new ExerciseError("NAO_ENCONTRADO", "Exercício não encontrado."));

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/exercises/e1/reativar", { method: "POST" }), {
      params: Promise.resolve({ id: "e1" }),
    });

    expect(response.status).toBe(404);
  });
});
