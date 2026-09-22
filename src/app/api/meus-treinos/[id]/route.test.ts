import { afterEach, describe, expect, it, vi } from "vitest";

const requireIndividual = vi.fn();
const updateWorkout = vi.fn();

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requireIndividual: (...args: unknown[]) => requireIndividual(...args) };
});

vi.mock("@/modules/workouts/workouts", async () => {
  const actual = await vi.importActual<typeof import("@/modules/workouts/workouts")>("@/modules/workouts/workouts");
  return { ...actual, updateWorkout: (...args: unknown[]) => updateWorkout(...args) };
});

function makeParams(id: string) {
  return Promise.resolve({ id });
}

describe("PATCH /api/meus-treinos/[id]", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requireIndividual.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { PATCH } = await import("./route");
    const response = await PATCH(new Request("http://localhost/api/meus-treinos/w1", { method: "PATCH", body: "{}" }), {
      params: makeParams("w1"),
    });

    expect(response.status).toBe(401);
  });

  it("edita usando o tenantId da sessão, ignora qualquer tenantId enviado no corpo", async () => {
    requireIndividual.mockResolvedValue({ userId: "u1", role: "INDIVIDUAL", tenantId: "tenant-real" });
    updateWorkout.mockResolvedValue({ id: "w1", name: "Editado" });

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/meus-treinos/w1", {
        method: "PATCH",
        body: JSON.stringify({ name: "Editado", tenantId: "tenant-adulterado" }),
      }),
      { params: makeParams("w1") }
    );

    expect(response.status).toBe(200);
    expect(updateWorkout).toHaveBeenCalledWith({ tenantId: "tenant-real", workoutId: "w1", name: "Editado" });
  });

  it("retorna 400 quando o nome não é informado", async () => {
    requireIndividual.mockResolvedValue({ userId: "u1", role: "INDIVIDUAL", tenantId: "tenant-real" });

    const { PATCH } = await import("./route");
    const response = await PATCH(new Request("http://localhost/api/meus-treinos/w1", { method: "PATCH", body: "{}" }), {
      params: makeParams("w1"),
    });

    expect(response.status).toBe(400);
    expect(updateWorkout).not.toHaveBeenCalled();
  });

  it("retorna 404 quando o treino não pertence ao tenant da sessão", async () => {
    const { WorkoutError } = await vi.importActual<typeof import("@/modules/workouts/workouts")>("@/modules/workouts/workouts");
    requireIndividual.mockResolvedValue({ userId: "u1", role: "INDIVIDUAL", tenantId: "tenant-real" });
    updateWorkout.mockRejectedValue(new WorkoutError("NAO_ENCONTRADO", "Modelo de treino não encontrado."));

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/meus-treinos/w1", { method: "PATCH", body: JSON.stringify({ name: "x" }) }),
      { params: makeParams("w1") }
    );

    expect(response.status).toBe(404);
  });
});
