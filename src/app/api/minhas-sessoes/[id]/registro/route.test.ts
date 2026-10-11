// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireSelfStudent: vi.fn(), updateRetroactiveWorkout: vi.fn(), deleteFinishedWorkoutSession: vi.fn() }));
vi.mock("@/modules/tenancy/selfStudent", () => ({ requireSelfStudent: mocks.requireSelfStudent }));
vi.mock("@/modules/execution/retroactive", () => ({ updateRetroactiveWorkout: mocks.updateRetroactiveWorkout }));
vi.mock("@/modules/execution/sessions", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/modules/execution/sessions")>()), deleteFinishedWorkoutSession: mocks.deleteFinishedWorkoutSession }));

import { SessionError } from "@/modules/execution/sessions";
import { PUT } from "./route";
import { DELETE } from "../route";

const params = { params: Promise.resolve({ id: "s1" }) };
const put = (body: unknown) => new Request("http://x", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const body = { performedAt: "2026-10-09T21:30:00.000Z", durationSeconds: 2700, exercises: [{ exerciseId: "leg", sets: [{ reps: 10, loadKg: 33 }] }], studentId: "intruso" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("FEATURE_RETROATIVO", "on");
  mocks.requireSelfStudent.mockResolvedValue({ userId: "u1", role: "ALUNO", tenantId: "t1", studentId: "s-aluno" });
});
afterEach(() => vi.unstubAllEnvs());

describe("PUT /api/minhas-sessoes/[id]/registro", () => {
  it("edita sempre o próprio registro, com quem editou", async () => {
    mocks.updateRetroactiveWorkout.mockResolvedValue({ sessionId: "s1" });
    expect((await PUT(put(body), params)).status).toBe(200);
    expect(mocks.updateRetroactiveWorkout).toHaveBeenCalledWith({ tenantId: "t1", studentId: "s-aluno", actorUserId: "u1", sessionId: "s1", performedAt: new Date(body.performedAt), durationSeconds: 2700, exercises: [{ exerciseId: "leg", sets: [{ reps: 10, loadKg: 33, durationSeconds: null }] }] });
  });

  it("fora do prazo vira 409; desligado, 404", async () => {
    mocks.updateRetroactiveWorkout.mockRejectedValue(new SessionError("ESTADO_INVALIDO", "O prazo para editar este registro acabou."));
    expect((await PUT(put(body), params)).status).toBe(409);
    vi.stubEnv("FEATURE_RETROATIVO", "off");
    expect((await PUT(put(body), params)).status).toBe(404);
  });
});

describe("DELETE /api/minhas-sessoes/[id]", () => {
  it("aluno só exclui o que registrou; Livre exclui qualquer treino seu", async () => {
    expect((await DELETE(new Request("http://x", { method: "DELETE" }), params)).status).toBe(204);
    expect(mocks.deleteFinishedWorkoutSession).toHaveBeenLastCalledWith({ tenantId: "t1", studentId: "s-aluno", actorUserId: "u1", onlyRetroactive: true, sessionId: "s1" });
    mocks.requireSelfStudent.mockResolvedValue({ userId: "u2", role: "INDIVIDUAL", tenantId: "t2", studentId: "s-livre" });
    await DELETE(new Request("http://x", { method: "DELETE" }), params);
    expect(mocks.deleteFinishedWorkoutSession).toHaveBeenLastCalledWith({ tenantId: "t2", studentId: "s-livre", actorUserId: "u2", onlyRetroactive: false, sessionId: "s1" });
  });
});
