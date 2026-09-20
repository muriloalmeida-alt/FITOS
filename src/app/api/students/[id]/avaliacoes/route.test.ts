import { afterEach, describe, expect, it, vi } from "vitest";

const requirePersonal = vi.fn();
const createAssessment = vi.fn();

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
    "@/modules/tenancy/authContext"
  );
  return { ...actual, requirePersonal: (...args: unknown[]) => requirePersonal(...args) };
});

vi.mock("@/modules/evolution/assessments", async () => {
  const actual = await vi.importActual<typeof import("@/modules/evolution/assessments")>(
    "@/modules/evolution/assessments"
  );
  return { ...actual, createAssessment: (...args: unknown[]) => createAssessment(...args) };
});

describe("POST /api/students/[id]/avaliacoes", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
      "@/modules/tenancy/authContext"
    );
    requirePersonal.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/students/s1/avaliacoes", { method: "POST", body: "{}" }), {
      params: Promise.resolve({ id: "s1" }),
    });

    expect(response.status).toBe(401);
  });

  it("retorna 400 quando um tipo de medida é inválido", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "t1" });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/students/s1/avaliacoes", {
        method: "POST",
        body: JSON.stringify({ measurements: [{ type: "PESCOCO", valueCm: 40 }] }),
      }),
      { params: Promise.resolve({ id: "s1" }) }
    );

    expect(response.status).toBe(400);
    expect(createAssessment).not.toHaveBeenCalled();
  });

  it("retorna 400 quando um valor numérico é inválido", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "t1" });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/students/s1/avaliacoes", {
        method: "POST",
        body: JSON.stringify({ weightKg: "abc" }),
      }),
      { params: Promise.resolve({ id: "s1" }) }
    );

    expect(response.status).toBe(400);
    expect(createAssessment).not.toHaveBeenCalled();
  });

  it("cria usando o tenantId e actorUserId da sessão, nunca do corpo", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    createAssessment.mockResolvedValue({ id: "a1", weightGrams: 82500 });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/students/s1/avaliacoes", {
        method: "POST",
        body: JSON.stringify({
          weightKg: 82.5,
          bodyFatPercent: 18.5,
          notes: "Boa evolução",
          measurements: [{ type: "CINTURA", valueCm: 85 }],
          tenantId: "outro-tenant",
          actorUserId: "outro-user",
        }),
      }),
      { params: Promise.resolve({ id: "s1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.weightGrams).toBe(82500);
    expect(createAssessment).toHaveBeenCalledWith({
      tenantId: "tenant-real",
      actorUserId: "u1",
      studentId: "s1",
      weightKg: 82.5,
      bodyFatPercent: 18.5,
      notes: "Boa evolução",
      measurementsCm: [{ type: "CINTURA", valueCm: 85 }],
    });
  });

  it("retorna 404 quando o aluno não pertence ao tenant da sessão", async () => {
    const { AssessmentError } = await vi.importActual<typeof import("@/modules/evolution/assessments")>(
      "@/modules/evolution/assessments"
    );
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "t1" });
    createAssessment.mockRejectedValue(new AssessmentError("NAO_ENCONTRADO", "Aluno não encontrado."));

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/students/s1/avaliacoes", { method: "POST", body: "{}" }), {
      params: Promise.resolve({ id: "s1" }),
    });

    expect(response.status).toBe(404);
  });
});
