import { afterEach, describe, expect, it, vi } from "vitest";

const requirePersonal = vi.fn();
const duplicateWorkout = vi.fn();

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requirePersonal: (...args: unknown[]) => requirePersonal(...args) };
});

vi.mock("@/modules/workouts/workouts", async () => {
  const actual = await vi.importActual<typeof import("@/modules/workouts/workouts")>("@/modules/workouts/workouts");
  return { ...actual, duplicateWorkout: (...args: unknown[]) => duplicateWorkout(...args) };
});

describe("POST /api/workouts/[id]/duplicar", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requirePersonal.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/workouts/w1/duplicar", { method: "POST" }), {
      params: Promise.resolve({ id: "w1" }),
    });

    expect(response.status).toBe(401);
  });

  it("duplica usando o tenantId da sessão", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    duplicateWorkout.mockResolvedValue({ id: "w2", name: "Treino A (cópia)" });

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/workouts/w1/duplicar", { method: "POST" }), {
      params: Promise.resolve({ id: "w1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.name).toBe("Treino A (cópia)");
    expect(duplicateWorkout).toHaveBeenCalledWith({ tenantId: "tenant-real", workoutId: "w1" });
  });

  it("retorna 404 quando o modelo não pertence ao tenant da sessão", async () => {
    const { WorkoutError } = await vi.importActual<typeof import("@/modules/workouts/workouts")>("@/modules/workouts/workouts");
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    duplicateWorkout.mockRejectedValue(new WorkoutError("NAO_ENCONTRADO", "Modelo de treino não encontrado."));

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/workouts/w1/duplicar", { method: "POST" }), {
      params: Promise.resolve({ id: "w1" }),
    });

    expect(response.status).toBe(404);
  });
});
