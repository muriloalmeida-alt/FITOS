import { afterEach, describe, expect, it, vi } from "vitest";

const requireStudent = vi.fn();
const recordWorkoutSet = vi.fn();
const removeWorkoutSet = vi.fn();

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requireStudent: (...args: unknown[]) => requireStudent(...args) };
});
vi.mock("@/modules/execution/sets", () => ({
  recordWorkoutSet: (...args: unknown[]) => recordWorkoutSet(...args),
  removeWorkoutSet: (...args: unknown[]) => removeWorkoutSet(...args),
}));

const req = (method: string, body: unknown) => new Request("http://localhost/api/workout-sessions/sess1/series", { method, body: JSON.stringify(body) });
const params = { params: Promise.resolve({ id: "sess1" }) };

describe("/api/workout-sessions/[id]/series (FIT-153, BK-11)", () => {
  afterEach(() => vi.resetAllMocks());

  it("grava a série no aluno da sessão e responde se foi recorde", async () => {
    requireStudent.mockResolvedValue({ userId: "u1", role: "ALUNO", tenantId: "t1", studentId: "s1" });
    recordWorkoutSet.mockResolvedValue({ set: { setNumber: 2 }, personalRecord: true });
    const { POST } = await import("./route");
    const response = await POST(req("POST", { workoutExerciseId: "we1", setNumber: 2, reps: 8, loadKg: 42.5, studentId: "outro" }), params);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ setNumber: 2, personalRecord: true });
    expect(recordWorkoutSet).toHaveBeenCalledWith({ tenantId: "t1", studentId: "s1", sessionId: "sess1", workoutExerciseId: "we1", setNumber: 2, reps: 8, durationSeconds: null, loadKg: 42.5 });
  });

  it("desfaz a série e valida o corpo", async () => {
    requireStudent.mockResolvedValue({ userId: "u1", role: "ALUNO", tenantId: "t1", studentId: "s1" });
    const { DELETE, POST } = await import("./route");
    expect((await DELETE(req("DELETE", { workoutExerciseId: "we1", setNumber: 1 }), params)).status).toBe(204);
    expect(removeWorkoutSet).toHaveBeenCalledWith({ tenantId: "t1", studentId: "s1", sessionId: "sess1", workoutExerciseId: "we1", setNumber: 1 });
    expect((await POST(req("POST", { setNumber: 1 }), params)).status).toBe(400);
  });

  it("sessão encerrada é 409", async () => {
    requireStudent.mockResolvedValue({ userId: "u1", role: "ALUNO", tenantId: "t1", studentId: "s1" });
    const { SessionError } = await vi.importActual<typeof import("@/modules/execution/sessions")>("@/modules/execution/sessions");
    recordWorkoutSet.mockRejectedValue(new SessionError("ESTADO_INVALIDO", "x"));
    const { POST } = await import("./route");
    expect((await POST(req("POST", { workoutExerciseId: "we1", setNumber: 1, reps: 10 }), params)).status).toBe(409);
  });
});
