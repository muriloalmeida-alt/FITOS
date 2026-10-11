// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireSelfStudent: vi.fn(), createFriendGroup: vi.fn(), joinFriendGroup: vi.fn(), startFriendSeason: vi.fn(), leaveFriendGroup: vi.fn() }));
vi.mock("@/modules/tenancy/selfStudent", () => ({ requireSelfStudent: mocks.requireSelfStudent }));
vi.mock("@/modules/gamification/friendGroups", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/gamification/friendGroups")>()),
  createFriendGroup: mocks.createFriendGroup,
  joinFriendGroup: mocks.joinFriendGroup,
  startFriendSeason: mocks.startFriendSeason,
  leaveFriendGroup: mocks.leaveFriendGroup,
}));

import { AuthError } from "@/modules/tenancy/authContext";
import { FriendGroupError } from "@/modules/gamification/friendGroups";
import { POST as create } from "./route";
import { POST as join } from "./entrar/route";
import { POST as season } from "./[id]/temporada/route";
import { POST as leave } from "./[id]/sair/route";

const post = (body: unknown) => new Request("http://x", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const params = { params: Promise.resolve({ id: "g1" }) };
const self = { userId: "u1", tenantId: "t1", studentId: "s1" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("FEATURE_GAMIFICACAO", "on");
  mocks.requireSelfStudent.mockResolvedValue({ ...self, role: "ALUNO" });
});
afterEach(() => vi.unstubAllEnvs());

describe("rotas de Amigos", () => {
  it("desligado: 404 sem tocar em nada", async () => {
    vi.stubEnv("FEATURE_GAMIFICACAO", "off");
    expect((await create(post({}))).status).toBe(404);
    expect(mocks.requireSelfStudent).not.toHaveBeenCalled();
  });

  it("sempre sobre quem treina, nunca sobre o corpo", async () => {
    mocks.createFriendGroup.mockResolvedValue({ id: "g1", inviteCode: "ABCD2345" });
    const response = await create(post({ name: "Corrida", mode: "TOTAL", lengthDays: 7, userId: "intruso" }));
    expect(response.status).toBe(201);
    expect(mocks.createFriendGroup).toHaveBeenCalledWith(self, { name: "Corrida", mode: "TOTAL", lengthDays: 7 });
    mocks.joinFriendGroup.mockResolvedValue({ groupId: "g1" });
    await join(post({ code: "abcd2345", studentId: "intruso" }));
    expect(mocks.joinFriendGroup).toHaveBeenCalledWith(self, "abcd2345");
    mocks.startFriendSeason.mockResolvedValue({ startsAt: new Date(), endsAt: new Date() });
    await season(post({ lengthDays: 14 }), params);
    expect(mocks.startFriendSeason).toHaveBeenCalledWith(self, "g1", 14);
    expect((await leave(post({}), params)).status).toBe(204);
    expect(mocks.leaveFriendGroup).toHaveBeenCalledWith(self, "g1");
  });

  it("erros viram status: personal 403, não organizador 403, temporada em andamento 409, não membro 404", async () => {
    mocks.requireSelfStudent.mockRejectedValueOnce(new AuthError("FORBIDDEN", "Acesso restrito a quem treina."));
    expect((await create(post({}))).status).toBe(403);
    mocks.startFriendSeason.mockRejectedValueOnce(new FriendGroupError("PROIBIDO", "x")).mockRejectedValueOnce(new FriendGroupError("CONFLITO", "x"));
    expect((await season(post({ lengthDays: 7 }), params)).status).toBe(403);
    expect((await season(post({ lengthDays: 7 }), params)).status).toBe(409);
    mocks.leaveFriendGroup.mockRejectedValueOnce(new FriendGroupError("NAO_ENCONTRADO", "x"));
    expect((await leave(post({}), params)).status).toBe(404);
  });
});
