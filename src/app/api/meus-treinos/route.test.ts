import { afterEach, describe, expect, it, vi } from "vitest";

const requireIndividual = vi.fn();
const createWorkout = vi.fn();

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requireIndividual: (...args: unknown[]) => requireIndividual(...args) };
});

vi.mock("@/modules/workouts/workouts", async () => {
  const actual = await vi.importActual<typeof import("@/modules/workouts/workouts")>("@/modules/workouts/workouts");
  return { ...actual, createWorkout: (...args: unknown[]) => createWorkout(...args) };
});

describe("POST /api/meus-treinos", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requireIndividual.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/meus-treinos", { method: "POST", body: JSON.stringify({ name: "x" }) }));

    expect(response.status).toBe(401);
  });

  it("retorna 403 quando o usuário autenticado não é individual", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requireIndividual.mockRejectedValue(new AuthError("FORBIDDEN", "Acesso restrito ao workspace individual (FitOS Livre)."));

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/meus-treinos", { method: "POST", body: JSON.stringify({ name: "x" }) }));

    expect(response.status).toBe(403);
    expect(createWorkout).not.toHaveBeenCalled();
  });

  it("cria usando o tenantId da sessão, ignora qualquer tenantId enviado no corpo", async () => {
    requireIndividual.mockResolvedValue({ userId: "u1", role: "INDIVIDUAL", tenantId: "tenant-real" });
    createWorkout.mockResolvedValue({ id: "w1", name: "Treino A" });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/meus-treinos", {
        method: "POST",
        body: JSON.stringify({ name: "Treino A", tenantId: "tenant-adulterado" }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.name).toBe("Treino A");
    expect(createWorkout).toHaveBeenCalledWith({ tenantId: "tenant-real", name: "Treino A" });
  });

  it("retorna 400 quando o nome não é informado", async () => {
    requireIndividual.mockResolvedValue({ userId: "u1", role: "INDIVIDUAL", tenantId: "tenant-real" });

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/meus-treinos", { method: "POST", body: JSON.stringify({}) }));

    expect(response.status).toBe(400);
    expect(createWorkout).not.toHaveBeenCalled();
  });
});
