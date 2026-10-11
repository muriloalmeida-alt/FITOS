import { afterEach, describe, expect, it, vi } from "vitest";

const requireStudent = vi.fn();
const completeWorkoutSession = vi.fn();
const getSessionSummary = vi.fn();

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
    "@/modules/tenancy/authContext"
  );
  return { ...actual, requireStudent: (...args: unknown[]) => requireStudent(...args) };
});

vi.mock("@/modules/execution/sessions", async () => {
  const actual = await vi.importActual<typeof import("@/modules/execution/sessions")>("@/modules/execution/sessions");
  return { ...actual, completeWorkoutSession: (...args: unknown[]) => completeWorkoutSession(...args) };
});

vi.mock("@/modules/execution/sets", () => ({ getSessionSummary: (...args: unknown[]) => getSessionSummary(...args) }));

describe("POST /api/workout-sessions/[id]/concluir", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
      "@/modules/tenancy/authContext"
    );
    requireStudent.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/workout-sessions/sess1/concluir", { method: "POST" }), {
      params: Promise.resolve({ id: "sess1" }),
    });

    expect(response.status).toBe(401);
  });

  it("conclui usando o tenantId e studentId da sessão", async () => {
    requireStudent.mockResolvedValue({ userId: "u1", role: "ALUNO", tenantId: "tenant-real", studentId: "student-real" });
    completeWorkoutSession.mockResolvedValue({ id: "sess1", status: "CONCLUIDA" });
    getSessionSummary.mockResolvedValue({ activeSeconds: 2400, sets: 12, volumeKg: 3200, records: [], perceivedEffort: null });

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/workout-sessions/sess1/concluir", { method: "POST", body: JSON.stringify({ activeSeconds: 2400.4 }) }), {
      params: Promise.resolve({ id: "sess1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("CONCLUIDA");
    expect(body.summary.sets).toBe(12);
    expect(completeWorkoutSession).toHaveBeenCalledWith({
      tenantId: "tenant-real",
      studentId: "student-real",
      sessionId: "sess1",
      activeSeconds: 2400,
    });
  });

  it("retorna 404 quando a sessão não pertence ao aluno", async () => {
    const { SessionError } = await vi.importActual<typeof import("@/modules/execution/sessions")>(
      "@/modules/execution/sessions"
    );
    requireStudent.mockResolvedValue({ userId: "u1", role: "ALUNO", tenantId: "t1", studentId: "s1" });
    completeWorkoutSession.mockRejectedValue(new SessionError("NAO_ENCONTRADO", "Sessão não encontrada."));

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/workout-sessions/sess1/concluir", { method: "POST" }), {
      params: Promise.resolve({ id: "sess1" }),
    });

    expect(response.status).toBe(404);
  });
});
