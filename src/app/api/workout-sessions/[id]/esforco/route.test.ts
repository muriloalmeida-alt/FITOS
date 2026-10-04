import { afterEach, describe, expect, it, vi } from "vitest";

const requireStudent = vi.fn();
const rateWorkoutSession = vi.fn();

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requireStudent: (...args: unknown[]) => requireStudent(...args) };
});
vi.mock("@/modules/execution/sessions", async () => {
  const actual = await vi.importActual<typeof import("@/modules/execution/sessions")>("@/modules/execution/sessions");
  return { ...actual, rateWorkoutSession: (...args: unknown[]) => rateWorkoutSession(...args) };
});

describe("POST /api/workout-sessions/[id]/esforco (FIT-153, BK-13)", () => {
  afterEach(() => vi.resetAllMocks());

  it("avalia a sessão do próprio aluno", async () => {
    requireStudent.mockResolvedValue({ userId: "u1", role: "ALUNO", tenantId: "t1", studentId: "s1" });
    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ perceivedEffort: 4 }) }), { params: Promise.resolve({ id: "sess1" }) });
    expect(response.status).toBe(204);
    expect(rateWorkoutSession).toHaveBeenCalledWith({ tenantId: "t1", studentId: "s1", sessionId: "sess1", perceivedEffort: 4 });
  });

  it("fora da faixa é 400", async () => {
    requireStudent.mockResolvedValue({ userId: "u1", role: "ALUNO", tenantId: "t1", studentId: "s1" });
    const { SessionError } = await vi.importActual<typeof import("@/modules/execution/sessions")>("@/modules/execution/sessions");
    rateWorkoutSession.mockRejectedValue(new SessionError("VALIDACAO", "Escolha de 1 a 5."));
    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ perceivedEffort: 9 }) }), { params: Promise.resolve({ id: "sess1" }) });
    expect(response.status).toBe(400);
  });
});
