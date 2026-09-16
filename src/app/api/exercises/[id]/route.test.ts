import { afterEach, describe, expect, it, vi } from "vitest";

const requirePersonal = vi.fn();
const updateOwnExercise = vi.fn();

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
    "@/modules/tenancy/authContext"
  );
  return { ...actual, requirePersonal: (...args: unknown[]) => requirePersonal(...args) };
});

vi.mock("@/modules/exercises/exercises", async () => {
  const actual = await vi.importActual<typeof import("@/modules/exercises/exercises")>("@/modules/exercises/exercises");
  return { ...actual, updateOwnExercise: (...args: unknown[]) => updateOwnExercise(...args) };
});

function makeParams(id: string) {
  return Promise.resolve({ id });
}

describe("PATCH /api/exercises/[id]", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
      "@/modules/tenancy/authContext"
    );
    requirePersonal.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { PATCH } = await import("./route");
    const response = await PATCH(new Request("http://localhost/api/exercises/e1", { method: "PATCH", body: "{}" }), {
      params: makeParams("e1"),
    });

    expect(response.status).toBe(401);
  });

  it("edita usando o tenantId da sessão, ignora qualquer tenantId/origin enviado no corpo", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    updateOwnExercise.mockResolvedValue({ id: "e1", muscle: "costas" });

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/exercises/e1", {
        method: "PATCH",
        body: JSON.stringify({ muscle: "costas", tenantId: "tenant-adulterado", origin: "API_NINJAS" }),
      }),
      { params: makeParams("e1") }
    );

    expect(response.status).toBe(200);
    expect(updateOwnExercise).toHaveBeenCalledWith({
      tenantId: "tenant-real",
      exerciseId: "e1",
      actorUserId: "u1",
      name: undefined,
      type: undefined,
      muscle: "costas",
      equipments: undefined,
      instructions: undefined,
    });
  });

  it("retorna 404 quando o exercício não pertence ao tenant da sessão (tenant adulterado / cruzado)", async () => {
    const { ExerciseError } = await vi.importActual<typeof import("@/modules/exercises/exercises")>(
      "@/modules/exercises/exercises"
    );
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    updateOwnExercise.mockRejectedValue(new ExerciseError("NAO_ENCONTRADO", "Exercício não encontrado."));

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/exercises/e1", { method: "PATCH", body: JSON.stringify({ muscle: "costas" }) }),
      { params: makeParams("e1") }
    );

    expect(response.status).toBe(404);
  });
});
