import { afterEach, describe, expect, it, vi } from "vitest";

const requirePersonal = vi.fn();
const createTrainingPlan = vi.fn();

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requirePersonal: (...args: unknown[]) => requirePersonal(...args) };
});

vi.mock("@/modules/workouts/workouts", async () => {
  const actual = await vi.importActual<typeof import("@/modules/workouts/workouts")>("@/modules/workouts/workouts");
  return { ...actual, createTrainingPlan: (...args: unknown[]) => createTrainingPlan(...args) };
});

describe("POST /api/training-plans", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requirePersonal.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/training-plans", { method: "POST", body: JSON.stringify({ name: "x" }) }));

    expect(response.status).toBe(401);
  });

  it("retorna 403 quando o usuário autenticado é aluno", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requirePersonal.mockRejectedValue(new AuthError("FORBIDDEN", "Acesso restrito a personal."));

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/training-plans", { method: "POST", body: JSON.stringify({ name: "x" }) }));

    expect(response.status).toBe(403);
    expect(createTrainingPlan).not.toHaveBeenCalled();
  });

  it("cria usando o tenantId da sessão, ignora qualquer tenantId enviado no corpo", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    createTrainingPlan.mockResolvedValue({ id: "p1", name: "Plano A" });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/training-plans", {
        method: "POST",
        body: JSON.stringify({ name: "Plano A", durationWeeks: 4, tenantId: "tenant-adulterado" }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.name).toBe("Plano A");
    expect(createTrainingPlan).toHaveBeenCalledWith({ tenantId: "tenant-real", name: "Plano A", durationWeeks: 4 });
  });

  it("retorna 400 quando o nome não é informado", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/training-plans", { method: "POST", body: JSON.stringify({}) }));

    expect(response.status).toBe(400);
    expect(createTrainingPlan).not.toHaveBeenCalled();
  });
});
