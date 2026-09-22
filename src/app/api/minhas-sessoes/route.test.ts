import { afterEach, describe, expect, it, vi } from "vitest";

const requireIndividual = vi.fn();
const ensureStudentForIndividual = vi.fn();
const startOrResumeIndividualWorkoutSession = vi.fn();

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

vi.mock("@/modules/execution/sessions", async () => {
  const actual = await vi.importActual<typeof import("@/modules/execution/sessions")>("@/modules/execution/sessions");
  return {
    ...actual,
    startOrResumeIndividualWorkoutSession: (...args: unknown[]) => startOrResumeIndividualWorkoutSession(...args),
  };
});

describe("POST /api/minhas-sessoes", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requireIndividual.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/minhas-sessoes", { method: "POST", body: JSON.stringify({ workoutId: "w1" }) })
    );

    expect(response.status).toBe(401);
  });

  it("retorna 403 quando o autenticado não é individual", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requireIndividual.mockRejectedValue(new AuthError("FORBIDDEN", "Acesso restrito ao workspace individual (FitOS Livre)."));

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/minhas-sessoes", { method: "POST", body: JSON.stringify({ workoutId: "w1" }) })
    );

    expect(response.status).toBe(403);
  });

  it("retorna 400 quando workoutId não é informado", async () => {
    requireIndividual.mockResolvedValue({ userId: "u1", role: "INDIVIDUAL", tenantId: "t1" });

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/minhas-sessoes", { method: "POST", body: "{}" }));

    expect(response.status).toBe(400);
    expect(startOrResumeIndividualWorkoutSession).not.toHaveBeenCalled();
  });

  it("inicia usando o tenantId da sessão e o studentId de auto-referência, nunca do corpo", async () => {
    requireIndividual.mockResolvedValue({ userId: "u1", role: "INDIVIDUAL", tenantId: "tenant-real" });
    ensureStudentForIndividual.mockResolvedValue({ id: "student-auto-referencia" });
    startOrResumeIndividualWorkoutSession.mockResolvedValue({ id: "sess1", status: "EM_ANDAMENTO" });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/minhas-sessoes", {
        method: "POST",
        body: JSON.stringify({ workoutId: "w1", studentId: "outro", tenantId: "outro-tenant" }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.status).toBe("EM_ANDAMENTO");
    expect(ensureStudentForIndividual).toHaveBeenCalledWith({ id: "tenant-real", ownerId: "u1" });
    expect(startOrResumeIndividualWorkoutSession).toHaveBeenCalledWith({
      tenantId: "tenant-real",
      studentId: "student-auto-referencia",
      workoutId: "w1",
    });
  });

  it("retorna 404 quando o treino não pertence ao tenant ou não está ativo", async () => {
    const { SessionError } = await vi.importActual<typeof import("@/modules/execution/sessions")>("@/modules/execution/sessions");
    requireIndividual.mockResolvedValue({ userId: "u1", role: "INDIVIDUAL", tenantId: "t1" });
    ensureStudentForIndividual.mockResolvedValue({ id: "s1" });
    startOrResumeIndividualWorkoutSession.mockRejectedValue(new SessionError("NAO_ENCONTRADO", "Treino não encontrado."));

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/minhas-sessoes", { method: "POST", body: JSON.stringify({ workoutId: "w1" }) })
    );

    expect(response.status).toBe(404);
  });
});
