import { afterEach, describe, expect, it, vi } from "vitest";

const requireIndividual = vi.fn();
const ensureStudentForIndividual = vi.fn();
const createAssessment = vi.fn();
const listAssessmentsForStudent = vi.fn();

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

vi.mock("@/modules/evolution/assessments", async () => {
  const actual = await vi.importActual<typeof import("@/modules/evolution/assessments")>("@/modules/evolution/assessments");
  return {
    ...actual,
    createAssessment: (...args: unknown[]) => createAssessment(...args),
    listAssessmentsForStudent: (...args: unknown[]) => listAssessmentsForStudent(...args),
  };
});

describe("GET /api/minhas-avaliacoes", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requireIndividual.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("lista as autoavaliações do próprio praticante", async () => {
    requireIndividual.mockResolvedValue({ userId: "u1", role: "INDIVIDUAL", tenantId: "t1" });
    ensureStudentForIndividual.mockResolvedValue({ id: "student-auto-referencia" });
    listAssessmentsForStudent.mockResolvedValue([{ id: "a1", weightGrams: 80000 }]);

    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([{ id: "a1", weightGrams: 80000 }]);
    expect(listAssessmentsForStudent).toHaveBeenCalledWith({ tenantId: "t1", studentId: "student-auto-referencia" });
  });
});

describe("POST /api/minhas-avaliacoes", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 400 quando o corpo é inválido", async () => {
    requireIndividual.mockResolvedValue({ userId: "u1", role: "INDIVIDUAL", tenantId: "t1" });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/minhas-avaliacoes", { method: "POST", body: JSON.stringify({ weightKg: "80" }) })
    );

    expect(response.status).toBe(400);
  });

  it("cria a autoavaliação com actorUserId igual ao studentId de auto-referência", async () => {
    requireIndividual.mockResolvedValue({ userId: "u1", role: "INDIVIDUAL", tenantId: "t1" });
    ensureStudentForIndividual.mockResolvedValue({ id: "student-auto-referencia" });
    createAssessment.mockResolvedValue({ id: "a1", weightGrams: 82500 });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/minhas-avaliacoes", {
        method: "POST",
        body: JSON.stringify({
          weightKg: 82.5,
          bodyFatPercent: null,
          notes: null,
          measurementsCm: [{ type: "CINTURA", valueCm: 85 }],
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.id).toBe("a1");
    expect(createAssessment).toHaveBeenCalledWith({
      tenantId: "t1",
      actorUserId: "u1",
      studentId: "student-auto-referencia",
      weightKg: 82.5,
      bodyFatPercent: null,
      notes: null,
      measurementsCm: [{ type: "CINTURA", valueCm: 85 }],
    });
  });

  it("retorna 400 quando AssessmentError de validação é lançado", async () => {
    const { AssessmentError } = await vi.importActual<typeof import("@/modules/evolution/assessments")>(
      "@/modules/evolution/assessments"
    );
    requireIndividual.mockResolvedValue({ userId: "u1", role: "INDIVIDUAL", tenantId: "t1" });
    ensureStudentForIndividual.mockResolvedValue({ id: "s1" });
    createAssessment.mockRejectedValue(new AssessmentError("VALIDACAO", "O peso deve ser maior que zero."));

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/minhas-avaliacoes", {
        method: "POST",
        body: JSON.stringify({ weightKg: -1, bodyFatPercent: null, notes: null, measurementsCm: [] }),
      })
    );

    expect(response.status).toBe(400);
  });
});
