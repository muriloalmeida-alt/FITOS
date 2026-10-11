// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireSession: vi.fn(), setClassRankingEnabled: vi.fn(), joinClassRanking: vi.fn(), leaveClassRanking: vi.fn() }));
vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requireSession: mocks.requireSession };
});
vi.mock("@/modules/gamification/classRanking", async () => {
  const actual = await vi.importActual<typeof import("@/modules/gamification/classRanking")>("@/modules/gamification/classRanking");
  return { ...actual, setClassRankingEnabled: mocks.setClassRankingEnabled, joinClassRanking: mocks.joinClassRanking, leaveClassRanking: mocks.leaveClassRanking };
});
vi.mock("server-only", () => ({}));

import { RankingError } from "@/modules/gamification/classRanking";
import { PATCH } from "./route";
import { DELETE, POST } from "./participar/route";

const patch = (body: unknown) => new Request("http://x", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("FEATURE_GAMIFICACAO", "on");
});
afterEach(() => vi.unstubAllEnvs());

describe("ranking da turma (rotas)", () => {
  it("só o personal liga, no próprio espaço; aluno recebe 403", async () => {
    mocks.requireSession.mockResolvedValue({ role: "PERSONAL", tenantId: "t1", userId: "p" });
    mocks.setClassRankingEnabled.mockResolvedValue({ enabled: true, activatedAt: new Date() });
    expect((await PATCH(patch({ enabled: true, tenantId: "outro" }))).status).toBe(200);
    expect(mocks.setClassRankingEnabled).toHaveBeenCalledWith("t1", true);
    expect((await PATCH(patch({ enabled: "sim" }))).status).toBe(400);
    mocks.requireSession.mockResolvedValue({ role: "ALUNO", tenantId: "t1", studentId: "s1", userId: "a" });
    expect((await PATCH(patch({ enabled: true }))).status).toBe(403);
  });

  it("só aluno com vínculo ativo entra/sai; Livre e personal 403; ranking desligado 409; flag desligada 404", async () => {
    mocks.requireSession.mockResolvedValue({ role: "ALUNO", tenantId: "t1", studentId: "s1", userId: "a" });
    expect((await POST()).status).toBe(204);
    expect(mocks.joinClassRanking).toHaveBeenCalledWith({ tenantId: "t1", studentId: "s1" });
    expect((await DELETE()).status).toBe(204);
    mocks.joinClassRanking.mockRejectedValueOnce(new RankingError("DESLIGADO", "O ranking da turma não está ligado."));
    expect((await POST()).status).toBe(409);
    mocks.requireSession.mockResolvedValue({ role: "INDIVIDUAL", tenantId: "t2", studentId: null, userId: "l" });
    expect((await POST()).status).toBe(403);
    mocks.requireSession.mockResolvedValue({ role: "ALUNO", tenantId: null, studentId: null, userId: "x" });
    expect((await POST()).status).toBe(403);
    vi.stubEnv("FEATURE_GAMIFICACAO", "off");
    expect((await POST()).status).toBe(404);
  });
});
