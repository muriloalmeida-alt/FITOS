import { afterEach, describe, expect, it, vi } from "vitest";

const requireStudent = vi.fn();
const completeWorkoutSession = vi.fn();

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

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/workout-sessions/sess1/concluir", { method: "POST" }), {
      params: Promise.resolve({ id: "sess1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("CONCLUIDA");
    expect(completeWorkoutSession).toHaveBeenCalledWith({
      tenantId: "tenant-real",
      studentId: "student-real",
      sessionId: "sess1",
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
