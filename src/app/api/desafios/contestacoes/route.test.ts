// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireSelfStudent: vi.fn(), requireSession: vi.fn(), openContest: vi.fn(), decideContest: vi.fn(), appealContest: vi.fn() }));
vi.mock("@/modules/tenancy/selfStudent", () => ({ requireSelfStudent: mocks.requireSelfStudent }));
vi.mock("@/modules/tenancy/authContext", async () => ({ ...(await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext")), requireSession: mocks.requireSession }));
vi.mock("@/modules/gamification/scoreContests", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/gamification/scoreContests")>()),
  openContest: mocks.openContest,
  decideContest: mocks.decideContest,
  appealContest: mocks.appealContest,
}));

import { ContestError } from "@/modules/gamification/scoreContests";
import { POST as open } from "./route";
import { POST as decide } from "./[id]/decisao/route";
import { POST as appeal } from "./recurso/route";

const post = (body: unknown) => new Request("http://x", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const self = { userId: "u1", tenantId: "t1", studentId: "s1" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("FEATURE_GAMIFICACAO", "on");
  mocks.requireSelfStudent.mockResolvedValue({ ...self, role: "INDIVIDUAL" });
  mocks.requireSession.mockResolvedValue({ userId: "rev" });
});
afterEach(() => vi.unstubAllEnvs());

describe("rotas de contestação", () => {
  it("desligado: 404", async () => {
    vi.stubEnv("FEATURE_GAMIFICACAO", "off");
    expect((await open(post({}))).status).toBe(404);
  });

  it("abre sobre quem treina; decide como quem está logado; recorre sobre o próprio treino", async () => {
    mocks.openContest.mockResolvedValue({ id: "c1" });
    expect((await open(post({ context: "AMIGOS", groupId: "g1", scoreId: "sc1", reason: "Foto estranha", userId: "intruso" }))).status).toBe(201);
    expect(mocks.openContest).toHaveBeenCalledWith(self, { context: "AMIGOS", groupId: "g1" }, "sc1", "Foto estranha");
    await open(post({ context: "TURMA", scoreId: "sc2", reason: "Pontos demais" }));
    expect(mocks.openContest).toHaveBeenLastCalledWith(self, { context: "TURMA" }, "sc2", "Pontos demais");

    mocks.decideContest.mockResolvedValue({ status: "ANULADO" });
    expect((await decide(post({ outcome: "ANULADO", decision: "Foto de outro dia" }), { params: Promise.resolve({ id: "c1" }) })).status).toBe(200);
    expect(mocks.decideContest).toHaveBeenCalledWith({ userId: "rev" }, "c1", "ANULADO", "Foto de outro dia");

    mocks.appealContest.mockResolvedValue({ id: "c2" });
    expect((await appeal(post({ scoreId: "sc1", reason: "Treinei sim" }))).status).toBe(201);
    expect(mocks.appealContest).toHaveBeenCalledWith(self, "sc1", "Treinei sim");
  });

  it("erros de domínio viram status", async () => {
    mocks.openContest.mockRejectedValueOnce(new ContestError("CONFLITO", "Já está em contestação."));
    expect((await open(post({ context: "TURMA", scoreId: "x", reason: "abcdef" }))).status).toBe(409);
    mocks.decideContest.mockRejectedValueOnce(new ContestError("NAO_ENCONTRADO", "Caso não encontrado."));
    expect((await decide(post({}), { params: Promise.resolve({ id: "c9" }) })).status).toBe(404);
  });
});
