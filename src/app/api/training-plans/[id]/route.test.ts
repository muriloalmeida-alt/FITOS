import { afterEach, describe, expect, it, vi } from "vitest";

const requirePersonal = vi.fn();
const updateTrainingPlan = vi.fn();

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requirePersonal: (...args: unknown[]) => requirePersonal(...args) };
});

vi.mock("@/modules/workouts/workouts", async () => {
  const actual = await vi.importActual<typeof import("@/modules/workouts/workouts")>("@/modules/workouts/workouts");
  return { ...actual, updateTrainingPlan: (...args: unknown[]) => updateTrainingPlan(...args) };
});

function makeParams(id: string) {
  return Promise.resolve({ id });
}

describe("PATCH /api/training-plans/[id]", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requirePersonal.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { PATCH } = await import("./route");
    const response = await PATCH(new Request("http://localhost/api/training-plans/p1", { method: "PATCH", body: "{}" }), {
      params: makeParams("p1"),
    });

    expect(response.status).toBe(401);
  });

  it("edita usando o tenantId da sessão, ignora qualquer tenantId enviado no corpo", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    updateTrainingPlan.mockResolvedValue({ id: "p1", name: "Editado" });

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/training-plans/p1", {
        method: "PATCH",
        body: JSON.stringify({ name: "Editado", durationWeeks: 6, tenantId: "tenant-adulterado" }),
      }),
      { params: makeParams("p1") }
    );

    expect(response.status).toBe(200);
    expect(updateTrainingPlan).toHaveBeenCalledWith({
      tenantId: "tenant-real",
      trainingPlanId: "p1",
      name: "Editado",
      durationWeeks: 6,
    });
  });

  it("retorna 404 quando o plano não pertence ao tenant da sessão", async () => {
    const { WorkoutError } = await vi.importActual<typeof import("@/modules/workouts/workouts")>("@/modules/workouts/workouts");
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    updateTrainingPlan.mockRejectedValue(new WorkoutError("NAO_ENCONTRADO", "Plano não encontrado."));

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/training-plans/p1", { method: "PATCH", body: JSON.stringify({ name: "x" }) }),
      { params: makeParams("p1") }
    );

    expect(response.status).toBe(404);
  });
});
