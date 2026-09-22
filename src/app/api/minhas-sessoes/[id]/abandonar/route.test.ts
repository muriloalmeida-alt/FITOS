import { afterEach, describe, expect, it, vi } from "vitest";

const requireIndividual = vi.fn();
const ensureStudentForIndividual = vi.fn();
const abandonWorkoutSession = vi.fn();

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
  return { ...actual, abandonWorkoutSession: (...args: unknown[]) => abandonWorkoutSession(...args) };
});

describe("POST /api/minhas-sessoes/[id]/abandonar", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requireIndividual.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/minhas-sessoes/sess1/abandonar", { method: "POST" }), {
      params: Promise.resolve({ id: "sess1" }),
    });

    expect(response.status).toBe(401);
  });

  it("abandona usando o tenantId da sessão e o studentId de auto-referência", async () => {
    requireIndividual.mockResolvedValue({ userId: "u1", role: "INDIVIDUAL", tenantId: "tenant-real" });
    ensureStudentForIndividual.mockResolvedValue({ id: "student-auto-referencia" });
    abandonWorkoutSession.mockResolvedValue({ id: "sess1", status: "ABANDONADA" });

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/minhas-sessoes/sess1/abandonar", { method: "POST" }), {
      params: Promise.resolve({ id: "sess1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ABANDONADA");
    expect(abandonWorkoutSession).toHaveBeenCalledWith({
      tenantId: "tenant-real",
      studentId: "student-auto-referencia",
      sessionId: "sess1",
    });
  });

  it("retorna 404 quando a sessão não pertence ao praticante", async () => {
    const { SessionError } = await vi.importActual<typeof import("@/modules/execution/sessions")>("@/modules/execution/sessions");
    requireIndividual.mockResolvedValue({ userId: "u1", role: "INDIVIDUAL", tenantId: "t1" });
    ensureStudentForIndividual.mockResolvedValue({ id: "s1" });
    abandonWorkoutSession.mockRejectedValue(new SessionError("NAO_ENCONTRADO", "Sessão não encontrada."));

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/minhas-sessoes/sess1/abandonar", { method: "POST" }), {
      params: Promise.resolve({ id: "sess1" }),
    });

    expect(response.status).toBe(404);
  });
});
