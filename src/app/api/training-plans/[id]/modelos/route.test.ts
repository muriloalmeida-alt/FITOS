import { afterEach, describe, expect, it, vi } from "vitest";

const requirePersonal = vi.fn();
const moveWorkoutToPlan = vi.fn();

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requirePersonal: (...args: unknown[]) => requirePersonal(...args) };
});

vi.mock("@/modules/workouts/workouts", async () => {
  const actual = await vi.importActual<typeof import("@/modules/workouts/workouts")>("@/modules/workouts/workouts");
  return { ...actual, moveWorkoutToPlan: (...args: unknown[]) => moveWorkoutToPlan(...args) };
});

function makeParams(id: string) {
  return Promise.resolve({ id });
}

describe("POST /api/training-plans/[id]/modelos", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requirePersonal.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/training-plans/p1/modelos", { method: "POST", body: JSON.stringify({ workoutId: "w1" }) }),
      { params: makeParams("p1") }
    );

    expect(response.status).toBe(401);
  });

  it("adiciona (move) usando o tenantId da sessão", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    moveWorkoutToPlan.mockResolvedValue({ id: "w1", trainingPlanId: "p1" });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/training-plans/p1/modelos", {
        method: "POST",
        body: JSON.stringify({ workoutId: "w1", tenantId: "tenant-adulterado" }),
      }),
      { params: makeParams("p1") }
    );

    expect(response.status).toBe(201);
    expect(moveWorkoutToPlan).toHaveBeenCalledWith({ tenantId: "tenant-real", workoutId: "w1", targetTrainingPlanId: "p1" });
  });

  it("retorna 400 quando workoutId não é informado", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/training-plans/p1/modelos", { method: "POST", body: "{}" }), {
      params: makeParams("p1"),
    });

    expect(response.status).toBe(400);
    expect(moveWorkoutToPlan).not.toHaveBeenCalled();
  });

  it("retorna 404 quando o modelo ou o plano não pertencem ao tenant da sessão", async () => {
    const { WorkoutError } = await vi.importActual<typeof import("@/modules/workouts/workouts")>("@/modules/workouts/workouts");
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    moveWorkoutToPlan.mockRejectedValue(new WorkoutError("NAO_ENCONTRADO", "Modelo de treino não encontrado."));

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/training-plans/p1/modelos", { method: "POST", body: JSON.stringify({ workoutId: "w1" }) }),
      { params: makeParams("p1") }
    );

    expect(response.status).toBe(404);
  });
});
