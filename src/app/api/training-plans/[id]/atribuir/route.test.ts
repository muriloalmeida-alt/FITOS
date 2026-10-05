import { afterEach, describe, expect, it, vi } from "vitest";

const requirePersonal = vi.fn();
const assignTrainingPlanToStudents = vi.fn();

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requirePersonal: (...args: unknown[]) => requirePersonal(...args) };
});

vi.mock("@/modules/workouts/workouts", async () => {
  const actual = await vi.importActual<typeof import("@/modules/workouts/workouts")>("@/modules/workouts/workouts");
  return { ...actual, assignTrainingPlanToStudents: (...args: unknown[]) => assignTrainingPlanToStudents(...args) };
});

const params = { params: Promise.resolve({ id: "p1" }) };

function post(body: unknown) {
  return new Request("http://localhost/api/training-plans/p1/atribuir", { method: "POST", body: JSON.stringify(body) });
}

describe("POST /api/training-plans/[id]/atribuir (BK-03)", () => {
  afterEach(() => vi.resetAllMocks());

  it("retorna 403 para aluno, sem chamar o módulo", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requirePersonal.mockRejectedValue(new AuthError("FORBIDDEN", "Acesso restrito a personal."));
    const { POST } = await import("./route");
    expect((await POST(post({ studentIds: ["s1"] }), params)).status).toBe(403);
    expect(assignTrainingPlanToStudents).not.toHaveBeenCalled();
  });

  it("usa o tenant da sessão e devolve 201", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    assignTrainingPlanToStudents.mockResolvedValue([{ id: "i1" }, { id: "i2" }]);
    const { POST } = await import("./route");
    const response = await POST(post({ studentIds: ["s1", "s2"], tenantId: "outro" }), params);
    expect(response.status).toBe(201);
    expect(assignTrainingPlanToStudents).toHaveBeenCalledWith({ tenantId: "tenant-real", actorUserId: "u1", trainingPlanId: "p1", studentIds: ["s1", "s2"] });
  });

  it("valida o corpo e traduz NAO_ENCONTRADO em 404", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "t" });
    const { POST } = await import("./route");
    expect((await POST(post({ studentIds: "s1" }), params)).status).toBe(400);
    const { WorkoutError } = await vi.importActual<typeof import("@/modules/workouts/workouts")>("@/modules/workouts/workouts");
    assignTrainingPlanToStudents.mockRejectedValue(new WorkoutError("NAO_ENCONTRADO", "Plano não encontrado."));
    expect((await POST(post({ studentIds: ["s1"] }), params)).status).toBe(404);
  });
});
