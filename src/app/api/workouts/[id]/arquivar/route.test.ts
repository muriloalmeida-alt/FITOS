import { afterEach, describe, expect, it, vi } from "vitest";

const requirePersonal = vi.fn();
const archiveWorkout = vi.fn();

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requirePersonal: (...args: unknown[]) => requirePersonal(...args) };
});

vi.mock("@/modules/workouts/workouts", async () => {
  const actual = await vi.importActual<typeof import("@/modules/workouts/workouts")>("@/modules/workouts/workouts");
  return { ...actual, archiveWorkout: (...args: unknown[]) => archiveWorkout(...args) };
});

describe("POST /api/workouts/[id]/arquivar", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requirePersonal.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/workouts/w1/arquivar", { method: "POST" }), {
      params: Promise.resolve({ id: "w1" }),
    });

    expect(response.status).toBe(401);
  });

  it("arquiva usando o tenantId da sessão", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    archiveWorkout.mockResolvedValue({ id: "w1", status: "ARQUIVADO" });

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/workouts/w1/arquivar", { method: "POST" }), {
      params: Promise.resolve({ id: "w1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ARQUIVADO");
    expect(archiveWorkout).toHaveBeenCalledWith({ tenantId: "tenant-real", workoutId: "w1" });
  });

  it("retorna 404 quando o modelo não pertence ao tenant da sessão", async () => {
    const { WorkoutError } = await vi.importActual<typeof import("@/modules/workouts/workouts")>("@/modules/workouts/workouts");
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    archiveWorkout.mockRejectedValue(new WorkoutError("NAO_ENCONTRADO", "Modelo de treino não encontrado."));

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/workouts/w1/arquivar", { method: "POST" }), {
      params: Promise.resolve({ id: "w1" }),
    });

    expect(response.status).toBe(404);
  });
});
