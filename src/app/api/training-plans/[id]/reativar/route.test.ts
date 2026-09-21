import { afterEach, describe, expect, it, vi } from "vitest";

const requirePersonal = vi.fn();
const reactivateTrainingPlan = vi.fn();

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requirePersonal: (...args: unknown[]) => requirePersonal(...args) };
});

vi.mock("@/modules/workouts/workouts", async () => {
  const actual = await vi.importActual<typeof import("@/modules/workouts/workouts")>("@/modules/workouts/workouts");
  return { ...actual, reactivateTrainingPlan: (...args: unknown[]) => reactivateTrainingPlan(...args) };
});

describe("POST /api/training-plans/[id]/reativar", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requirePersonal.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/training-plans/p1/reativar", { method: "POST" }), {
      params: Promise.resolve({ id: "p1" }),
    });

    expect(response.status).toBe(401);
  });

  it("reativa usando o tenantId da sessão", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    reactivateTrainingPlan.mockResolvedValue({ id: "p1", status: "ATIVO" });

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/training-plans/p1/reativar", { method: "POST" }), {
      params: Promise.resolve({ id: "p1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ATIVO");
    expect(reactivateTrainingPlan).toHaveBeenCalledWith({ tenantId: "tenant-real", trainingPlanId: "p1" });
  });
});
