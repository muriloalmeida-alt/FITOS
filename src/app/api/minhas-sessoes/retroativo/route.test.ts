// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireSelfStudent: vi.fn(), recordRetroactiveWorkout: vi.fn() }));
vi.mock("@/modules/tenancy/selfStudent", () => ({ requireSelfStudent: mocks.requireSelfStudent }));
vi.mock("@/modules/execution/retroactive", () => ({ recordRetroactiveWorkout: mocks.recordRetroactiveWorkout }));

import { AuthError } from "@/modules/tenancy/authContext";
import { SessionError } from "@/modules/execution/sessions";
import { POST } from "./route";

const post = (body: unknown) => new Request("http://x", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const body = { operationKey: "op-12345678", performedAt: "2026-10-07T21:30:00.000Z", durationSeconds: 2700, exercises: [{ exerciseId: "leg", sets: [{ reps: 10, loadKg: 30 }] }], studentId: "intruso" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("FEATURE_RETROATIVO", "on");
  mocks.requireSelfStudent.mockResolvedValue({ userId: "u1", role: "INDIVIDUAL", tenantId: "t1", studentId: "s1" });
});
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/minhas-sessoes/retroativo", () => {
  it("desligado: 404 sem tocar em nada", async () => {
    vi.stubEnv("FEATURE_RETROATIVO", "off");
    expect((await POST(post(body))).status).toBe(404);
    expect(mocks.requireSelfStudent).not.toHaveBeenCalled();
  });

  it("registra sempre para si (nunca o aluno vindo do corpo); repetição devolve 200", async () => {
    mocks.recordRetroactiveWorkout.mockResolvedValueOnce({ sessionId: "x", replayed: false, possibleDuplicate: false }).mockResolvedValueOnce({ sessionId: "x", replayed: true, possibleDuplicate: false });
    expect((await POST(post(body))).status).toBe(201);
    expect(mocks.recordRetroactiveWorkout).toHaveBeenCalledWith({ tenantId: "t1", studentId: "s1", operationKey: "op-12345678", performedAt: new Date(body.performedAt), durationSeconds: 2700, exercises: [{ exerciseId: "leg", sets: [{ reps: 10, loadKg: 30, durationSeconds: null }] }] });
    expect((await POST(post(body))).status).toBe(200);
  });

  it("personal recebe 403; validação vira 400", async () => {
    mocks.requireSelfStudent.mockRejectedValueOnce(new AuthError("FORBIDDEN", "Acesso restrito a quem treina."));
    expect((await POST(post(body))).status).toBe(403);
    mocks.recordRetroactiveWorkout.mockRejectedValueOnce(new SessionError("VALIDACAO", "Só dá para registrar treinos de até 7 dias atrás."));
    const response = await POST(post(body));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ message: "Só dá para registrar treinos de até 7 dias atrás." });
  });
});
