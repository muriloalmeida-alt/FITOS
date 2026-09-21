import { afterEach, describe, expect, it, vi } from "vitest";

const requirePersonal = vi.fn();
const assignTrainingPlanToStudent = vi.fn();
const unassignTrainingPlanFromStudent = vi.fn();

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
    "@/modules/tenancy/authContext"
  );
  return { ...actual, requirePersonal: (...args: unknown[]) => requirePersonal(...args) };
});

vi.mock("@/modules/workouts/workouts", async () => {
  const actual = await vi.importActual<typeof import("@/modules/workouts/workouts")>("@/modules/workouts/workouts");
  return {
    ...actual,
    assignTrainingPlanToStudent: (...args: unknown[]) => assignTrainingPlanToStudent(...args),
    unassignTrainingPlanFromStudent: (...args: unknown[]) => unassignTrainingPlanFromStudent(...args),
  };
});

describe("POST /api/students/[id]/plano", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
      "@/modules/tenancy/authContext"
    );
    requirePersonal.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/students/s1/plano", { method: "POST", body: JSON.stringify({ trainingPlanId: "p1" }) }),
      { params: Promise.resolve({ id: "s1" }) }
    );

    expect(response.status).toBe(401);
  });

  it("retorna 400 quando trainingPlanId não é informado", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/students/s1/plano", { method: "POST", body: "{}" }), {
      params: Promise.resolve({ id: "s1" }),
    });

    expect(response.status).toBe(400);
    expect(assignTrainingPlanToStudent).not.toHaveBeenCalled();
  });

  it("atribui usando o tenantId e userId da sessão", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    assignTrainingPlanToStudent.mockResolvedValue({ id: "a1", studentId: "s1", trainingPlanId: "snap1", active: true });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/students/s1/plano", {
        method: "POST",
        body: JSON.stringify({ trainingPlanId: "p1" }),
      }),
      { params: Promise.resolve({ id: "s1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.active).toBe(true);
    expect(assignTrainingPlanToStudent).toHaveBeenCalledWith({
      tenantId: "tenant-real",
      actorUserId: "u1",
      studentId: "s1",
      trainingPlanId: "p1",
    });
  });

  it("retorna 404 quando o aluno ou o plano não pertencem ao tenant da sessão", async () => {
    const { WorkoutError } = await vi.importActual<typeof import("@/modules/workouts/workouts")>(
      "@/modules/workouts/workouts"
    );
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    assignTrainingPlanToStudent.mockRejectedValue(new WorkoutError("NAO_ENCONTRADO", "Aluno não encontrado."));

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/students/s1/plano", {
        method: "POST",
        body: JSON.stringify({ trainingPlanId: "p1" }),
      }),
      { params: Promise.resolve({ id: "s1" }) }
    );

    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/students/[id]/plano", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
      "@/modules/tenancy/authContext"
    );
    requirePersonal.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { DELETE } = await import("./route");
    const response = await DELETE(new Request("http://localhost/api/students/s1/plano", { method: "DELETE" }), {
      params: Promise.resolve({ id: "s1" }),
    });

    expect(response.status).toBe(401);
  });

  it("encerra usando o tenantId e userId da sessão", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    unassignTrainingPlanFromStudent.mockResolvedValue({ id: "a1", active: false });

    const { DELETE } = await import("./route");
    const response = await DELETE(new Request("http://localhost/api/students/s1/plano", { method: "DELETE" }), {
      params: Promise.resolve({ id: "s1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.active).toBe(false);
    expect(unassignTrainingPlanFromStudent).toHaveBeenCalledWith({
      tenantId: "tenant-real",
      actorUserId: "u1",
      studentId: "s1",
    });
  });

  it("é idempotente: sem atribuição ativa, retorna null com status 200", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    unassignTrainingPlanFromStudent.mockResolvedValue(null);

    const { DELETE } = await import("./route");
    const response = await DELETE(new Request("http://localhost/api/students/s1/plano", { method: "DELETE" }), {
      params: Promise.resolve({ id: "s1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toBeNull();
  });
});
