import { afterEach, describe, expect, it, vi } from "vitest";

const requireStudent = vi.fn();
const startOrResumeWorkoutSession = vi.fn();

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
    "@/modules/tenancy/authContext"
  );
  return { ...actual, requireStudent: (...args: unknown[]) => requireStudent(...args) };
});

vi.mock("@/modules/execution/sessions", async () => {
  const actual = await vi.importActual<typeof import("@/modules/execution/sessions")>("@/modules/execution/sessions");
  return { ...actual, startOrResumeWorkoutSession: (...args: unknown[]) => startOrResumeWorkoutSession(...args) };
});

describe("POST /api/workout-sessions", () => {
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
      new Request("http://localhost/api/workout-sessions", { method: "POST", body: JSON.stringify({ workoutId: "w1" }) })
    );

    expect(response.status).toBe(401);
  });

  it("retorna 403 quando o autenticado não é aluno com vínculo ativo", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
      "@/modules/tenancy/authContext"
    );
    requireStudent.mockRejectedValue(new AuthError("FORBIDDEN", "Acesso restrito a aluno com vínculo ativo."));

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/workout-sessions", { method: "POST", body: JSON.stringify({ workoutId: "w1" }) })
    );

    expect(response.status).toBe(403);
  });

  it("retorna 400 quando workoutId não é informado", async () => {
    requireStudent.mockResolvedValue({ userId: "u1", role: "ALUNO", tenantId: "t1", studentId: "s1" });

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/workout-sessions", { method: "POST", body: "{}" }));

    expect(response.status).toBe(400);
    expect(startOrResumeWorkoutSession).not.toHaveBeenCalled();
  });

  it("inicia usando o tenantId e studentId da sessão, nunca do corpo", async () => {
    requireStudent.mockResolvedValue({ userId: "u1", role: "ALUNO", tenantId: "tenant-real", studentId: "student-real" });
    startOrResumeWorkoutSession.mockResolvedValue({ id: "sess1", status: "EM_ANDAMENTO" });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/workout-sessions", {
        method: "POST",
        body: JSON.stringify({ workoutId: "w1", studentId: "outro-aluno", tenantId: "outro-tenant" }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.status).toBe("EM_ANDAMENTO");
    expect(startOrResumeWorkoutSession).toHaveBeenCalledWith({
      tenantId: "tenant-real",
      studentId: "student-real",
      workoutId: "w1",
    });
  });

  it("retorna 404 quando o treino não pertence ao plano atribuído", async () => {
    const { SessionError } = await vi.importActual<typeof import("@/modules/execution/sessions")>(
      "@/modules/execution/sessions"
    );
    requireStudent.mockResolvedValue({ userId: "u1", role: "ALUNO", tenantId: "t1", studentId: "s1" });
    startOrResumeWorkoutSession.mockRejectedValue(new SessionError("NAO_ENCONTRADO", "Treino não encontrado."));

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/workout-sessions", { method: "POST", body: JSON.stringify({ workoutId: "w1" }) })
    );

    expect(response.status).toBe(404);
  });
});
