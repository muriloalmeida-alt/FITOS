import { afterEach, describe, expect, it, vi } from "vitest";

const requireIndividual = vi.fn();
const reorderWorkoutExercises = vi.fn();

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requireIndividual: (...args: unknown[]) => requireIndividual(...args) };
});

vi.mock("@/modules/workouts/workouts", async () => {
  const actual = await vi.importActual<typeof import("@/modules/workouts/workouts")>("@/modules/workouts/workouts");
  return { ...actual, reorderWorkoutExercises: (...args: unknown[]) => reorderWorkoutExercises(...args) };
});

function makeParams(id: string) {
  return Promise.resolve({ id });
}

describe("POST /api/meus-treinos/[id]/itens/reordenar", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requireIndividual.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ orderedIds: ["a", "b"] }) }),
      { params: makeParams("w1") }
    );

    expect(response.status).toBe(401);
  });

  it("reordena usando o tenantId da sessão", async () => {
    requireIndividual.mockResolvedValue({ userId: "u1", role: "INDIVIDUAL", tenantId: "tenant-real" });
    reorderWorkoutExercises.mockResolvedValue(undefined);

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ orderedIds: ["b", "a"] }) }),
      { params: makeParams("w1") }
    );

    expect(response.status).toBe(204);
    expect(reorderWorkoutExercises).toHaveBeenCalledWith({ tenantId: "tenant-real", workoutId: "w1", orderedIds: ["b", "a"] });
  });

  it("retorna 400 quando orderedIds não é uma lista de strings", async () => {
    requireIndividual.mockResolvedValue({ userId: "u1", role: "INDIVIDUAL", tenantId: "tenant-real" });

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ orderedIds: "x" }) }), {
      params: makeParams("w1"),
    });

    expect(response.status).toBe(400);
    expect(reorderWorkoutExercises).not.toHaveBeenCalled();
  });
});
