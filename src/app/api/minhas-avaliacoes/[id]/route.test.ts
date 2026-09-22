import { afterEach, describe, expect, it, vi } from "vitest";

const requireIndividual = vi.fn();
const softDeleteAssessment = vi.fn();

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requireIndividual: (...args: unknown[]) => requireIndividual(...args) };
});

vi.mock("@/modules/evolution/assessments", async () => {
  const actual = await vi.importActual<typeof import("@/modules/evolution/assessments")>("@/modules/evolution/assessments");
  return { ...actual, softDeleteAssessment: (...args: unknown[]) => softDeleteAssessment(...args) };
});

describe("DELETE /api/minhas-avaliacoes/[id]", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requireIndividual.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { DELETE } = await import("./route");
    const response = await DELETE(new Request("http://localhost/api/minhas-avaliacoes/a1", { method: "DELETE" }), {
      params: Promise.resolve({ id: "a1" }),
    });

    expect(response.status).toBe(401);
  });

  it("exclui usando o tenantId da sessão e o próprio usuário como actorUserId", async () => {
    requireIndividual.mockResolvedValue({ userId: "u1", role: "INDIVIDUAL", tenantId: "tenant-real" });
    softDeleteAssessment.mockResolvedValue({ id: "a1", deletedAt: new Date() });

    const { DELETE } = await import("./route");
    const response = await DELETE(new Request("http://localhost/api/minhas-avaliacoes/a1", { method: "DELETE" }), {
      params: Promise.resolve({ id: "a1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.id).toBe("a1");
    expect(softDeleteAssessment).toHaveBeenCalledWith({ tenantId: "tenant-real", actorUserId: "u1", assessmentId: "a1" });
  });

  it("retorna 404 quando a avaliação não pertence ao praticante", async () => {
    const { AssessmentError } = await vi.importActual<typeof import("@/modules/evolution/assessments")>(
      "@/modules/evolution/assessments"
    );
    requireIndividual.mockResolvedValue({ userId: "u1", role: "INDIVIDUAL", tenantId: "t1" });
    softDeleteAssessment.mockRejectedValue(new AssessmentError("NAO_ENCONTRADO", "Avaliação não encontrada."));

    const { DELETE } = await import("./route");
    const response = await DELETE(new Request("http://localhost/api/minhas-avaliacoes/a1", { method: "DELETE" }), {
      params: Promise.resolve({ id: "a1" }),
    });

    expect(response.status).toBe(404);
  });
});
