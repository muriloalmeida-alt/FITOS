import { afterEach, describe, expect, it, vi } from "vitest";

const requireIndividual = vi.fn();
const ensureStudentForIndividual = vi.fn();
const abandonGoal = vi.fn();

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requireIndividual: (...args: unknown[]) => requireIndividual(...args) };
});

vi.mock("@/modules/tenancy/ensureStudentForIndividual", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/ensureStudentForIndividual")>(
    "@/modules/tenancy/ensureStudentForIndividual"
  );
  return { ...actual, ensureStudentForIndividual: (...args: unknown[]) => ensureStudentForIndividual(...args) };
});

vi.mock("@/modules/evolution/goals", async () => {
  const actual = await vi.importActual<typeof import("@/modules/evolution/goals")>("@/modules/evolution/goals");
  return { ...actual, abandonGoal: (...args: unknown[]) => abandonGoal(...args) };
});

describe("POST /api/minhas-metas/[id]/abandonar", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requireIndividual.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/minhas-metas/g1/abandonar", { method: "POST" }), {
      params: Promise.resolve({ id: "g1" }),
    });

    expect(response.status).toBe(401);
  });

  it("abandona usando o tenantId da sessão e o studentId de auto-referência", async () => {
    requireIndividual.mockResolvedValue({ userId: "u1", role: "INDIVIDUAL", tenantId: "tenant-real" });
    ensureStudentForIndividual.mockResolvedValue({ id: "student-auto-referencia" });
    abandonGoal.mockResolvedValue({ id: "g1", status: "ABANDONADA" });

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/minhas-metas/g1/abandonar", { method: "POST" }), {
      params: Promise.resolve({ id: "g1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ABANDONADA");
    expect(abandonGoal).toHaveBeenCalledWith({ tenantId: "tenant-real", studentId: "student-auto-referencia", goalId: "g1" });
  });

  it("retorna 404 quando a meta não pertence ao praticante", async () => {
    const { GoalError } = await vi.importActual<typeof import("@/modules/evolution/goals")>("@/modules/evolution/goals");
    requireIndividual.mockResolvedValue({ userId: "u1", role: "INDIVIDUAL", tenantId: "t1" });
    ensureStudentForIndividual.mockResolvedValue({ id: "s1" });
    abandonGoal.mockRejectedValue(new GoalError("NAO_ENCONTRADO", "Meta não encontrada."));

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/minhas-metas/g1/abandonar", { method: "POST" }), {
      params: Promise.resolve({ id: "g1" }),
    });

    expect(response.status).toBe(404);
  });
});
