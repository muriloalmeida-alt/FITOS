import { afterEach, describe, expect, it, vi } from "vitest";

const requireIndividual = vi.fn();
const updateWorkoutExercise = vi.fn();
const removeWorkoutExercise = vi.fn();

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requireIndividual: (...args: unknown[]) => requireIndividual(...args) };
});

vi.mock("@/modules/workouts/workouts", async () => {
  const actual = await vi.importActual<typeof import("@/modules/workouts/workouts")>("@/modules/workouts/workouts");
  return {
    ...actual,
    updateWorkoutExercise: (...args: unknown[]) => updateWorkoutExercise(...args),
    removeWorkoutExercise: (...args: unknown[]) => removeWorkoutExercise(...args),
  };
});

function makeParams(id: string, itemId: string) {
  return Promise.resolve({ id, itemId });
}

describe("PATCH /api/meus-treinos/[id]/itens/[itemId]", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requireIndividual.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { PATCH } = await import("./route");
    const response = await PATCH(new Request("http://localhost/x", { method: "PATCH", body: "{}" }), {
      params: makeParams("w1", "wi1"),
    });

    expect(response.status).toBe(401);
  });

  it("edita usando o tenantId da sessão, aceita null para limpar campo numérico", async () => {
    requireIndividual.mockResolvedValue({ userId: "u1", role: "INDIVIDUAL", tenantId: "tenant-real" });
    updateWorkoutExercise.mockResolvedValue({ id: "wi1", sets: null });

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/x", { method: "PATCH", body: JSON.stringify({ sets: null, tenantId: "adulterado" }) }),
      { params: makeParams("w1", "wi1") }
    );

    expect(response.status).toBe(200);
    expect(updateWorkoutExercise).toHaveBeenCalledWith({
      tenantId: "tenant-real",
      workoutId: "w1",
      workoutExerciseId: "wi1",
      sets: null,
      reps: undefined,
      durationSeconds: undefined,
      restSeconds: undefined,
      load: undefined,
      notes: undefined,
    });
  });

  it("retorna 404 quando o item não pertence ao tenant da sessão", async () => {
    const { WorkoutError } = await vi.importActual<typeof import("@/modules/workouts/workouts")>("@/modules/workouts/workouts");
    requireIndividual.mockResolvedValue({ userId: "u1", role: "INDIVIDUAL", tenantId: "tenant-real" });
    updateWorkoutExercise.mockRejectedValue(new WorkoutError("NAO_ENCONTRADO", "Item do modelo de treino não encontrado."));

    const { PATCH } = await import("./route");
    const response = await PATCH(new Request("http://localhost/x", { method: "PATCH", body: JSON.stringify({ sets: 3 }) }), {
      params: makeParams("w1", "wi1"),
    });

    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/meus-treinos/[id]/itens/[itemId]", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requireIndividual.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { DELETE } = await import("./route");
    const response = await DELETE(new Request("http://localhost/x", { method: "DELETE" }), {
      params: makeParams("w1", "wi1"),
    });

    expect(response.status).toBe(401);
  });

  it("remove usando o tenantId da sessão", async () => {
    requireIndividual.mockResolvedValue({ userId: "u1", role: "INDIVIDUAL", tenantId: "tenant-real" });
    removeWorkoutExercise.mockResolvedValue(undefined);

    const { DELETE } = await import("./route");
    const response = await DELETE(new Request("http://localhost/x", { method: "DELETE" }), {
      params: makeParams("w1", "wi1"),
    });

    expect(response.status).toBe(204);
    expect(removeWorkoutExercise).toHaveBeenCalledWith({ tenantId: "tenant-real", workoutId: "w1", workoutExerciseId: "wi1" });
  });

  it("retorna 404 quando o item não pertence ao tenant da sessão", async () => {
    const { WorkoutError } = await vi.importActual<typeof import("@/modules/workouts/workouts")>("@/modules/workouts/workouts");
    requireIndividual.mockResolvedValue({ userId: "u1", role: "INDIVIDUAL", tenantId: "tenant-real" });
    removeWorkoutExercise.mockRejectedValue(new WorkoutError("NAO_ENCONTRADO", "Item do modelo de treino não encontrado."));

    const { DELETE } = await import("./route");
    const response = await DELETE(new Request("http://localhost/x", { method: "DELETE" }), {
      params: makeParams("w1", "wi1"),
    });

    expect(response.status).toBe(404);
  });
});
