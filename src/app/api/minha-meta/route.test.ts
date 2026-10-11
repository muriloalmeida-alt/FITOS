import { afterEach, describe, expect, it, vi } from "vitest";

const requireSelfStudent = vi.fn();
const createGoal = vi.fn();
vi.mock("@/modules/tenancy/selfStudent", () => ({ requireSelfStudent: () => requireSelfStudent() }));
vi.mock("@/modules/evolution/goals", async () => {
  const actual = await vi.importActual<typeof import("@/modules/evolution/goals")>("@/modules/evolution/goals");
  return { ...actual, createGoal: (...args: unknown[]) => createGoal(...args) };
});
afterEach(() => vi.resetAllMocks());

function post(body: unknown) {
  return new Request("http://x/api/minha-meta", { method: "POST", body: JSON.stringify(body) });
}

describe("POST /api/minha-meta (EPIC-30)", () => {
  it("cria a meta escolhida para o próprio aluno", async () => {
    requireSelfStudent.mockResolvedValue({ userId: "u1", role: "ALUNO", tenantId: "t1", studentId: "s1" });
    createGoal.mockResolvedValue({ id: "g1" });
    const { POST } = await import("./route");
    const response = await POST(post({ description: "Perder 2 kg até janeiro", targetDate: "2027-01-31T00:00:00.000Z" }));
    expect(response.status).toBe(201);
    expect(createGoal).toHaveBeenCalledWith({ tenantId: "t1", studentId: "s1", description: "Perder 2 kg até janeiro", targetDate: new Date("2027-01-31T00:00:00.000Z") });
  });

  it("sem descrição ou com data inválida é 400", async () => {
    requireSelfStudent.mockResolvedValue({ userId: "u1", role: "ALUNO", tenantId: "t1", studentId: "s1" });
    const { POST } = await import("./route");
    expect((await POST(post({}))).status).toBe(400);
    expect((await POST(post({ description: "x", targetDate: "ontem" }))).status).toBe(400);
  });
});
