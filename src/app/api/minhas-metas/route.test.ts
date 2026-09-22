import { afterEach, describe, expect, it, vi } from "vitest";

const requireIndividual = vi.fn();
const ensureStudentForIndividual = vi.fn();
const createGoal = vi.fn();
const listGoalsForStudent = vi.fn();

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
  return {
    ...actual,
    createGoal: (...args: unknown[]) => createGoal(...args),
    listGoalsForStudent: (...args: unknown[]) => listGoalsForStudent(...args),
  };
});

describe("GET /api/minhas-metas", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requireIndividual.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("lista as metas do próprio praticante", async () => {
    requireIndividual.mockResolvedValue({ userId: "u1", role: "INDIVIDUAL", tenantId: "t1" });
    ensureStudentForIndividual.mockResolvedValue({ id: "student-auto-referencia" });
    listGoalsForStudent.mockResolvedValue([{ id: "g1", description: "Meta 1" }]);

    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([{ id: "g1", description: "Meta 1" }]);
    expect(listGoalsForStudent).toHaveBeenCalledWith({ tenantId: "t1", studentId: "student-auto-referencia" });
  });
});

describe("POST /api/minhas-metas", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 400 quando a descrição está ausente", async () => {
    requireIndividual.mockResolvedValue({ userId: "u1", role: "INDIVIDUAL", tenantId: "t1" });

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/minhas-metas", { method: "POST", body: JSON.stringify({}) }));

    expect(response.status).toBe(400);
  });

  it("cria a meta usando o tenantId da sessão e o studentId de auto-referência", async () => {
    requireIndividual.mockResolvedValue({ userId: "u1", role: "INDIVIDUAL", tenantId: "t1" });
    ensureStudentForIndividual.mockResolvedValue({ id: "student-auto-referencia" });
    createGoal.mockResolvedValue({ id: "g1", description: "Perder 5kg", status: "EM_ANDAMENTO" });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/minhas-metas", {
        method: "POST",
        body: JSON.stringify({ description: "Perder 5kg", targetDate: "2026-12-31" }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.description).toBe("Perder 5kg");
    expect(createGoal).toHaveBeenCalledWith({
      tenantId: "t1",
      studentId: "student-auto-referencia",
      description: "Perder 5kg",
      targetDate: new Date("2026-12-31"),
    });
  });

  it("retorna 400 quando GoalError de validação é lançado", async () => {
    const { GoalError } = await vi.importActual<typeof import("@/modules/evolution/goals")>("@/modules/evolution/goals");
    requireIndividual.mockResolvedValue({ userId: "u1", role: "INDIVIDUAL", tenantId: "t1" });
    ensureStudentForIndividual.mockResolvedValue({ id: "s1" });
    createGoal.mockRejectedValue(new GoalError("VALIDACAO", "A meta precisa de uma descrição."));

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/minhas-metas", { method: "POST", body: JSON.stringify({ description: "   " }) })
    );

    expect(response.status).toBe(400);
  });
});
