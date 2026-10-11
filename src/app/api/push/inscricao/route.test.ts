import { afterEach, describe, expect, it, vi } from "vitest";

const requireSession = vi.fn();
const saveSubscription = vi.fn();
vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requireSession: () => requireSession() };
});
vi.mock("@/modules/notifications/push", async () => {
  const actual = await vi.importActual<typeof import("@/modules/notifications/push")>("@/modules/notifications/push");
  return { ...actual, saveSubscription: (...args: unknown[]) => saveSubscription(...args), removeSubscription: vi.fn() };
});
afterEach(() => vi.resetAllMocks());

describe("POST /api/push/inscricao (EPIC-31)", () => {
  it("guarda o aparelho da sessão; rejeita inscrição inválida", async () => {
    requireSession.mockResolvedValue({ authenticated: true, userId: "u1", role: "ALUNO" });
    const { POST } = await import("./route");
    const subscription = { endpoint: "https://fcm.googleapis.com/x", keys: { p256dh: "p", auth: "a" } };
    const ok = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ subscription }), headers: { "user-agent": "Chrome" } }));
    expect(ok.status).toBe(204);
    expect(saveSubscription).toHaveBeenCalledWith({ userId: "u1", subscription, userAgent: "Chrome" });
    const bad = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ subscription: { endpoint: "http://inseguro" } }) }));
    expect(bad.status).toBe(400);
  });
});
