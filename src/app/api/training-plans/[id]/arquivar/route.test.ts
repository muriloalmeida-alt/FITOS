import { afterEach, describe, expect, it, vi } from "vitest";

const requirePersonal = vi.fn();
const archiveTrainingPlan = vi.fn();

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requirePersonal: (...args: unknown[]) => requirePersonal(...args) };
});

vi.mock("@/modules/workouts/workouts", async () => {
  const actual = await vi.importActual<typeof import("@/modules/workouts/workouts")>("@/modules/workouts/workouts");
  return { ...actual, archiveTrainingPlan: (...args: unknown[]) => archiveTrainingPlan(...args) };
});

describe("POST /api/training-plans/[id]/arquivar", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requirePersonal.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/training-plans/p1/arquivar", { method: "POST" }), {
      params: Promise.resolve({ id: "p1" }),
    });

    expect(response.status).toBe(401);
  });

  it("arquiva usando o tenantId da sessão", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    archiveTrainingPlan.mockResolvedValue({ id: "p1", status: "ARQUIVADO" });

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/training-plans/p1/arquivar", { method: "POST" }), {
      params: Promise.resolve({ id: "p1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ARQUIVADO");
    expect(archiveTrainingPlan).toHaveBeenCalledWith({ tenantId: "tenant-real", trainingPlanId: "p1" });
  });

  it("retorna 404 quando o plano não pertence ao tenant da sessão", async () => {
    const { WorkoutError } = await vi.importActual<typeof import("@/modules/workouts/workouts")>("@/modules/workouts/workouts");
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    archiveTrainingPlan.mockRejectedValue(new WorkoutError("NAO_ENCONTRADO", "Plano não encontrado."));

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/training-plans/p1/arquivar", { method: "POST" }), {
      params: Promise.resolve({ id: "p1" }),
    });

    expect(response.status).toBe(404);
  });
});
