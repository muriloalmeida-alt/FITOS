import { afterEach, describe, expect, it, vi } from "vitest";

const requirePersonal = vi.fn();
const addWorkoutExercise = vi.fn();

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requirePersonal: (...args: unknown[]) => requirePersonal(...args) };
});

vi.mock("@/modules/workouts/workouts", async () => {
  const actual = await vi.importActual<typeof import("@/modules/workouts/workouts")>("@/modules/workouts/workouts");
  return { ...actual, addWorkoutExercise: (...args: unknown[]) => addWorkoutExercise(...args) };
});

function makeParams(id: string) {
  return Promise.resolve({ id });
}

describe("POST /api/workouts/[id]/itens", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requirePersonal.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/workouts/w1/itens", { method: "POST", body: JSON.stringify({ exerciseId: "e1" }) }),
      { params: makeParams("w1") }
    );

    expect(response.status).toBe(401);
  });

  it("adiciona usando o tenantId da sessão, ignora qualquer tenantId enviado no corpo", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    addWorkoutExercise.mockResolvedValue({ id: "wi1", exerciseId: "e1" });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/workouts/w1/itens", {
        method: "POST",
        body: JSON.stringify({ exerciseId: "e1", sets: 3, reps: 10, tenantId: "tenant-adulterado" }),
      }),
      { params: makeParams("w1") }
    );

    expect(response.status).toBe(201);
    expect(addWorkoutExercise).toHaveBeenCalledWith({
      tenantId: "tenant-real",
      workoutId: "w1",
      exerciseId: "e1",
      sets: 3,
      reps: 10,
      durationSeconds: undefined,
      load: undefined,
      restSeconds: undefined,
      notes: undefined,
    });
  });

  it("retorna 400 quando exerciseId não é informado", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/workouts/w1/itens", { method: "POST", body: "{}" }), {
      params: makeParams("w1"),
    });

    expect(response.status).toBe(400);
    expect(addWorkoutExercise).not.toHaveBeenCalled();
  });

  it("retorna 404 quando o modelo não pertence ao tenant da sessão", async () => {
    const { WorkoutError } = await vi.importActual<typeof import("@/modules/workouts/workouts")>("@/modules/workouts/workouts");
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    addWorkoutExercise.mockRejectedValue(new WorkoutError("NAO_ENCONTRADO", "Modelo de treino não encontrado."));

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/workouts/w1/itens", { method: "POST", body: JSON.stringify({ exerciseId: "e1" }) }),
      { params: makeParams("w1") }
    );

    expect(response.status).toBe(404);
  });
});
