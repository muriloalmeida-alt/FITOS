import { afterEach, describe, expect, it, vi } from "vitest";

const requireStudent = vi.fn();
const recordSessionResult = vi.fn();

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
    "@/modules/tenancy/authContext"
  );
  return { ...actual, requireStudent: (...args: unknown[]) => requireStudent(...args) };
});

vi.mock("@/modules/execution/sessions", async () => {
  const actual = await vi.importActual<typeof import("@/modules/execution/sessions")>("@/modules/execution/sessions");
  return { ...actual, recordSessionResult: (...args: unknown[]) => recordSessionResult(...args) };
});

describe("POST /api/workout-sessions/[id]/resultados", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
      "@/modules/tenancy/authContext"
    );
    requireStudent.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/workout-sessions/sess1/resultados", {
        method: "POST",
        body: JSON.stringify({ workoutExerciseId: "i1" }),
      }),
      { params: Promise.resolve({ id: "sess1" }) }
    );

    expect(response.status).toBe(401);
  });

  it("retorna 400 quando workoutExerciseId não é informado", async () => {
    requireStudent.mockResolvedValue({ userId: "u1", role: "ALUNO", tenantId: "t1", studentId: "s1" });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/workout-sessions/sess1/resultados", { method: "POST", body: "{}" }),
      { params: Promise.resolve({ id: "sess1" }) }
    );

    expect(response.status).toBe(400);
    expect(recordSessionResult).not.toHaveBeenCalled();
  });

  it("retorna 400 quando um campo numérico é inválido", async () => {
    requireStudent.mockResolvedValue({ userId: "u1", role: "ALUNO", tenantId: "t1", studentId: "s1" });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/workout-sessions/sess1/resultados", {
        method: "POST",
        body: JSON.stringify({ workoutExerciseId: "i1", setsCompleted: "abc" }),
      }),
      { params: Promise.resolve({ id: "sess1" }) }
    );

    expect(response.status).toBe(400);
    expect(recordSessionResult).not.toHaveBeenCalled();
  });

  it("registra usando o tenantId e studentId da sessão", async () => {
    requireStudent.mockResolvedValue({ userId: "u1", role: "ALUNO", tenantId: "tenant-real", studentId: "student-real" });
    recordSessionResult.mockResolvedValue({ id: "r1", setsCompleted: 3 });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/workout-sessions/sess1/resultados", {
        method: "POST",
        body: JSON.stringify({ workoutExerciseId: "i1", setsCompleted: 3, repsCompleted: 10, loadUsed: "20kg" }),
      }),
      { params: Promise.resolve({ id: "sess1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.setsCompleted).toBe(3);
    expect(recordSessionResult).toHaveBeenCalledWith({
      tenantId: "tenant-real",
      studentId: "student-real",
      sessionId: "sess1",
      workoutExerciseId: "i1",
      setsCompleted: 3,
      repsCompleted: 10,
      durationSecondsCompleted: null,
      loadUsed: "20kg",
    });
  });

  it("retorna 400 quando a sessão já foi concluída (ESTADO_INVALIDO)", async () => {
    const { SessionError } = await vi.importActual<typeof import("@/modules/execution/sessions")>(
      "@/modules/execution/sessions"
    );
    requireStudent.mockResolvedValue({ userId: "u1", role: "ALUNO", tenantId: "t1", studentId: "s1" });
    recordSessionResult.mockRejectedValue(new SessionError("ESTADO_INVALIDO", "Sessão já concluída."));

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/workout-sessions/sess1/resultados", {
        method: "POST",
        body: JSON.stringify({ workoutExerciseId: "i1" }),
      }),
      { params: Promise.resolve({ id: "sess1" }) }
    );

    expect(response.status).toBe(400);
  });
});
