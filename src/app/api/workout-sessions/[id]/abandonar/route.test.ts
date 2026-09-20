import { afterEach, describe, expect, it, vi } from "vitest";

const requireStudent = vi.fn();
const abandonWorkoutSession = vi.fn();

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
    "@/modules/tenancy/authContext"
  );
  return { ...actual, requireStudent: (...args: unknown[]) => requireStudent(...args) };
});

vi.mock("@/modules/execution/sessions", async () => {
  const actual = await vi.importActual<typeof import("@/modules/execution/sessions")>("@/modules/execution/sessions");
  return { ...actual, abandonWorkoutSession: (...args: unknown[]) => abandonWorkoutSession(...args) };
});

describe("POST /api/workout-sessions/[id]/abandonar", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
      "@/modules/tenancy/authContext"
    );
    requireStudent.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/workout-sessions/sess1/abandonar", { method: "POST" }), {
      params: Promise.resolve({ id: "sess1" }),
    });

    expect(response.status).toBe(401);
  });

  it("abandona usando o tenantId e studentId da sessão", async () => {
    requireStudent.mockResolvedValue({ userId: "u1", role: "ALUNO", tenantId: "tenant-real", studentId: "student-real" });
    abandonWorkoutSession.mockResolvedValue({ id: "sess1", status: "ABANDONADA" });

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/workout-sessions/sess1/abandonar", { method: "POST" }), {
      params: Promise.resolve({ id: "sess1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ABANDONADA");
    expect(abandonWorkoutSession).toHaveBeenCalledWith({
      tenantId: "tenant-real",
      studentId: "student-real",
      sessionId: "sess1",
    });
  });

  it("retorna 400 quando a sessão já não está em andamento (ESTADO_INVALIDO)", async () => {
    const { SessionError } = await vi.importActual<typeof import("@/modules/execution/sessions")>(
      "@/modules/execution/sessions"
    );
    requireStudent.mockResolvedValue({ userId: "u1", role: "ALUNO", tenantId: "t1", studentId: "s1" });
    abandonWorkoutSession.mockRejectedValue(new SessionError("ESTADO_INVALIDO", "Sessão já concluída."));

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/workout-sessions/sess1/abandonar", { method: "POST" }), {
      params: Promise.resolve({ id: "sess1" }),
    });

    expect(response.status).toBe(400);
  });
});
