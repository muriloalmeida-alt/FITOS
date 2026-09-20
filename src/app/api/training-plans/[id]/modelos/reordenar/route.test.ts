import { afterEach, describe, expect, it, vi } from "vitest";

const requirePersonal = vi.fn();
const reorderWorkoutsInPlan = vi.fn();

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requirePersonal: (...args: unknown[]) => requirePersonal(...args) };
});

vi.mock("@/modules/workouts/workouts", async () => {
  const actual = await vi.importActual<typeof import("@/modules/workouts/workouts")>("@/modules/workouts/workouts");
  return { ...actual, reorderWorkoutsInPlan: (...args: unknown[]) => reorderWorkoutsInPlan(...args) };
});

function makeParams(id: string) {
  return Promise.resolve({ id });
}

describe("POST /api/training-plans/[id]/modelos/reordenar", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requirePersonal.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ orderedWorkoutIds: ["a", "b"] }) }),
      { params: makeParams("p1") }
    );

    expect(response.status).toBe(401);
  });

  it("reordena usando o tenantId da sessão", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    reorderWorkoutsInPlan.mockResolvedValue(undefined);

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ orderedWorkoutIds: ["b", "a"] }) }),
      { params: makeParams("p1") }
    );

    expect(response.status).toBe(204);
    expect(reorderWorkoutsInPlan).toHaveBeenCalledWith({ tenantId: "tenant-real", trainingPlanId: "p1", orderedWorkoutIds: ["b", "a"] });
  });

  it("retorna 400 quando orderedWorkoutIds não é uma lista de strings", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ orderedWorkoutIds: "x" }) }), {
      params: makeParams("p1"),
    });

    expect(response.status).toBe(400);
    expect(reorderWorkoutsInPlan).not.toHaveBeenCalled();
  });
});
