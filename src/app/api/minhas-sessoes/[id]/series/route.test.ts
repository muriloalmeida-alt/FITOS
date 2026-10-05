import { afterEach, describe, expect, it, vi } from "vitest";

const requireIndividual = vi.fn();
const ensureStudentForIndividual = vi.fn();
const recordWorkoutSet = vi.fn();

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requireIndividual: (...args: unknown[]) => requireIndividual(...args) };
});
vi.mock("@/modules/tenancy/ensureStudentForIndividual", () => ({ ensureStudentForIndividual: (...args: unknown[]) => ensureStudentForIndividual(...args) }));
vi.mock("@/modules/execution/sets", () => ({ recordWorkoutSet: (...args: unknown[]) => recordWorkoutSet(...args), removeWorkoutSet: vi.fn() }));

describe("POST /api/minhas-sessoes/[id]/series (FIT-158)", () => {
  afterEach(() => vi.resetAllMocks());

  it("grava a série do próprio praticante", async () => {
    requireIndividual.mockResolvedValue({ userId: "u1", role: "INDIVIDUAL", tenantId: "t1" });
    ensureStudentForIndividual.mockResolvedValue({ id: "self" });
    recordWorkoutSet.mockResolvedValue({ set: { setNumber: 1 }, personalRecord: false });
    const { POST } = await import("./route");
    const response = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ workoutExerciseId: "we1", setNumber: 1, reps: 12, loadKg: 20 }) }), { params: Promise.resolve({ id: "sess1" }) });
    expect(response.status).toBe(201);
    expect(recordWorkoutSet).toHaveBeenCalledWith({ tenantId: "t1", studentId: "self", sessionId: "sess1", workoutExerciseId: "we1", setNumber: 1, reps: 12, durationSeconds: null, loadKg: 20, performedExerciseId: null });
    expect(ensureStudentForIndividual).toHaveBeenCalledWith({ id: "t1", ownerId: "u1" });
  });

  it("aluno não usa a rota do Livre", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requireIndividual.mockRejectedValue(new AuthError("FORBIDDEN", "x"));
    const { POST } = await import("./route");
    const response = await POST(new Request("http://x", { method: "POST", body: "{}" }), { params: Promise.resolve({ id: "sess1" }) });
    expect(response.status).toBe(403);
  });
});
