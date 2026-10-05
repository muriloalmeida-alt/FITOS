import { afterEach, describe, expect, it, vi } from "vitest";

const requireSelfStudent = vi.fn();
const createAssessment = vi.fn();
vi.mock("@/modules/tenancy/selfStudent", () => ({ requireSelfStudent: () => requireSelfStudent() }));
vi.mock("@/modules/evolution/assessments", async () => {
  const actual = await vi.importActual<typeof import("@/modules/evolution/assessments")>("@/modules/evolution/assessments");
  return { ...actual, createAssessment: (...args: unknown[]) => createAssessment(...args) };
});
afterEach(() => vi.resetAllMocks());

function post(body: unknown) {
  return new Request("http://x/api/meu-peso", { method: "POST", body: JSON.stringify(body) });
}

describe("POST /api/meu-peso (EPIC-30)", () => {
  it("aluno registra só o peso, autorado por ele mesmo", async () => {
    requireSelfStudent.mockResolvedValue({ userId: "u1", role: "ALUNO", tenantId: "t1", studentId: "s1" });
    createAssessment.mockResolvedValue({ id: "a1" });
    const { POST } = await import("./route");
    const response = await POST(post({ weightKg: 64.34, bodyFatPercent: 20 }));
    expect(response.status).toBe(201);
    expect(createAssessment).toHaveBeenCalledWith({ tenantId: "t1", actorUserId: "u1", studentId: "s1", weightKg: 64.3, bodyFatPercent: null, notes: null, measurementsCm: [] });
  });

  it("Livre pode incluir gordura; peso inválido é 400", async () => {
    requireSelfStudent.mockResolvedValue({ userId: "u2", role: "INDIVIDUAL", tenantId: "t2", studentId: "s2" });
    createAssessment.mockResolvedValue({ id: "a2" });
    const { POST } = await import("./route");
    await POST(post({ weightKg: 80, bodyFatPercent: 18.5 }));
    expect(createAssessment).toHaveBeenCalledWith(expect.objectContaining({ bodyFatPercent: 18.5 }));
    expect((await POST(post({ weightKg: 5 }))).status).toBe(400);
  });

  it("personal não pesa por aqui (403)", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requireSelfStudent.mockRejectedValue(new AuthError("FORBIDDEN", "x"));
    const { POST } = await import("./route");
    expect((await POST(post({ weightKg: 70 }))).status).toBe(403);
  });
});
