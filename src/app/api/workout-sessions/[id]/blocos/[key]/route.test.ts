import { afterEach, describe, expect, it, vi } from "vitest";

const requireStudent = vi.fn();
const blockTimer = vi.fn();
const finishBlock = vi.fn();
const featureEnabled = vi.fn();

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requireStudent: (...args: unknown[]) => requireStudent(...args) };
});

vi.mock("@/modules/execution/blockResults", async () => {
  const actual = await vi.importActual<typeof import("@/modules/execution/blockResults")>("@/modules/execution/blockResults");
  return { ...actual, blockTimer: (...args: unknown[]) => blockTimer(...args), finishBlock: (...args: unknown[]) => finishBlock(...args) };
});

vi.mock("@/shared/config/features", () => ({ featureEnabled: (...args: unknown[]) => featureEnabled(...args) }));

const row = {
  id: "r1",
  tenantId: "t1",
  sessionId: "sess1",
  blockKey: "b1",
  startedAt: new Date("2026-10-11T10:00:00Z"),
  pausedAt: null,
  pausedSeconds: 0,
  endedAt: new Date("2026-10-11T10:09:42Z"),
  outcome: "CONCLUIDO",
  roundsCompleted: null,
  partialReps: null,
  intervalsCompleted: null,
  elapsedSeconds: 582,
  note: null,
};

const params = { params: Promise.resolve({ id: "sess1", key: "b1" }) };

describe("rotas do bloco do aluno", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 404 com a flag desligada", async () => {
    featureEnabled.mockReturnValue(false);
    const { PUT } = await import("./route");
    const response = await PUT(new Request("http://localhost/x", { method: "PUT", body: "{}" }), params);
    expect(response.status).toBe(404);
    expect(finishBlock).not.toHaveBeenCalled();
  });

  it("encerra o bloco com o escopo do aluno e devolve datas ISO", async () => {
    featureEnabled.mockReturnValue(true);
    requireStudent.mockResolvedValue({ tenantId: "t1", studentId: "s1" });
    finishBlock.mockResolvedValue(row);
    const { PUT } = await import("./route");
    const response = await PUT(new Request("http://localhost/x", { method: "PUT", body: JSON.stringify({ outcome: "CONCLUIDO", studentId: "outro" }) }), params);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ blockKey: "b1", endedAt: "2026-10-11T10:09:42.000Z", elapsedSeconds: 582 });
    expect(body.id).toBeUndefined();
    expect(finishBlock).toHaveBeenCalledWith({ tenantId: "t1", studentId: "s1" }, "sess1", "b1", expect.objectContaining({ outcome: "CONCLUIDO" }));
  });

  it("valida a ação do timer", async () => {
    featureEnabled.mockReturnValue(true);
    requireStudent.mockResolvedValue({ tenantId: "t1", studentId: "s1" });
    const { POST } = await import("./timer/route");
    const bad = await POST(new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ action: "PARAR" }) }), params);
    expect(bad.status).toBe(400);
    blockTimer.mockResolvedValue({ ...row, endedAt: null, outcome: null, elapsedSeconds: null });
    const ok = await POST(new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ action: "INICIAR" }) }), params);
    expect(ok.status).toBe(200);
    expect(blockTimer).toHaveBeenCalledWith({ tenantId: "t1", studentId: "s1" }, "sess1", "b1", "INICIAR");
  });

  it("mapeia erro de sessão encerrada para 409", async () => {
    featureEnabled.mockReturnValue(true);
    requireStudent.mockResolvedValue({ tenantId: "t1", studentId: "s1" });
    const { SessionError } = await import("@/modules/execution/sessions");
    finishBlock.mockRejectedValue(new SessionError("ESTADO_INVALIDO", "Sessão encerrada."));
    const { PUT } = await import("./route");
    const response = await PUT(new Request("http://localhost/x", { method: "PUT", body: "{}" }), params);
    expect(response.status).toBe(409);
  });
});
