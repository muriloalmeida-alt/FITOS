import { afterEach, describe, expect, it, vi } from "vitest";

const requirePersonal = vi.fn();
const removeWorkoutFromPlan = vi.fn();

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requirePersonal: (...args: unknown[]) => requirePersonal(...args) };
});

vi.mock("@/modules/workouts/workouts", async () => {
  const actual = await vi.importActual<typeof import("@/modules/workouts/workouts")>("@/modules/workouts/workouts");
  return { ...actual, removeWorkoutFromPlan: (...args: unknown[]) => removeWorkoutFromPlan(...args) };
});

function makeParams(id: string, workoutId: string) {
  return Promise.resolve({ id, workoutId });
}

describe("DELETE /api/training-plans/[id]/modelos/[workoutId]", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requirePersonal.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { DELETE } = await import("./route");
    const response = await DELETE(new Request("http://localhost/x", { method: "DELETE" }), {
      params: makeParams("p1", "w1"),
    });

    expect(response.status).toBe(401);
  });

  it("remove usando o tenantId da sessão", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    removeWorkoutFromPlan.mockResolvedValue({ id: "w1", trainingPlanId: "draft" });

    const { DELETE } = await import("./route");
    const response = await DELETE(new Request("http://localhost/x", { method: "DELETE" }), {
      params: makeParams("p1", "w1"),
    });

    expect(response.status).toBe(200);
    expect(removeWorkoutFromPlan).toHaveBeenCalledWith({ tenantId: "tenant-real", workoutId: "w1", trainingPlanId: "p1" });
  });

  it("retorna 404 quando o modelo não pertence ao plano informado", async () => {
    const { WorkoutError } = await vi.importActual<typeof import("@/modules/workouts/workouts")>("@/modules/workouts/workouts");
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    removeWorkoutFromPlan.mockRejectedValue(new WorkoutError("NAO_ENCONTRADO", "Modelo de treino não encontrado neste plano."));

    const { DELETE } = await import("./route");
    const response = await DELETE(new Request("http://localhost/x", { method: "DELETE" }), {
      params: makeParams("p1", "w1"),
    });

    expect(response.status).toBe(404);
  });
});
