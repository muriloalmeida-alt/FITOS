import { afterEach, describe, expect, it, vi } from "vitest";

const requirePersonal = vi.fn();
const softDeleteAssessment = vi.fn();

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
  return { ...actual, softDeleteAssessment: (...args: unknown[]) => softDeleteAssessment(...args) };
});

describe("DELETE /api/students/[id]/avaliacoes/[assessmentId]", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
      "@/modules/tenancy/authContext"
    );
    requirePersonal.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { DELETE } = await import("./route");
    const response = await DELETE(new Request("http://localhost/api/students/s1/avaliacoes/a1", { method: "DELETE" }), {
      params: Promise.resolve({ id: "s1", assessmentId: "a1" }),
    });

    expect(response.status).toBe(401);
  });

  it("exclui usando o tenantId e actorUserId da sessão", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    softDeleteAssessment.mockResolvedValue({ id: "a1", deletedAt: new Date().toISOString() });

    const { DELETE } = await import("./route");
    const response = await DELETE(new Request("http://localhost/api/students/s1/avaliacoes/a1", { method: "DELETE" }), {
      params: Promise.resolve({ id: "s1", assessmentId: "a1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.deletedAt).not.toBeNull();
    expect(softDeleteAssessment).toHaveBeenCalledWith({ tenantId: "tenant-real", actorUserId: "u1", assessmentId: "a1" });
  });

  it("retorna 404 quando a avaliação não pertence ao tenant da sessão", async () => {
    const { AssessmentError } = await vi.importActual<typeof import("@/modules/evolution/assessments")>(
      "@/modules/evolution/assessments"
    );
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "t1" });
    softDeleteAssessment.mockRejectedValue(new AssessmentError("NAO_ENCONTRADO", "Avaliação não encontrada."));

    const { DELETE } = await import("./route");
    const response = await DELETE(new Request("http://localhost/api/students/s1/avaliacoes/a1", { method: "DELETE" }), {
      params: Promise.resolve({ id: "s1", assessmentId: "a1" }),
    });

    expect(response.status).toBe(404);
  });
});
