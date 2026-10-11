import { afterEach, describe, expect, it, vi } from "vitest";

const requireSession = vi.fn();
const setReminderHour = vi.fn();
vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requireSession: () => requireSession() };
});
vi.mock("@/modules/notifications/reminders", () => ({ setReminderHour: (...args: unknown[]) => setReminderHour(...args), getReminderHour: async () => 7 }));
afterEach(() => vi.resetAllMocks());

const patch = (body: unknown) => new Request("http://x/api/minhas-notificacoes", { method: "PATCH", body: JSON.stringify(body) });

describe("/api/minhas-notificacoes (EPIC-31)", () => {
  it("aluno liga e desliga o lembrete", async () => {
    requireSession.mockResolvedValue({ authenticated: true, userId: "u1", role: "ALUNO" });
    const { PATCH } = await import("./route");
    expect((await PATCH(patch({ reminderHour: 18 }))).status).toBe(200);
    expect(setReminderHour).toHaveBeenCalledWith("u1", 18);
    expect((await PATCH(patch({ reminderHour: null }))).status).toBe(200);
    expect((await PATCH(patch({ reminderHour: 24 }))).status).toBe(400);
  });

  it("personal não tem lembrete de treino", async () => {
    requireSession.mockResolvedValue({ authenticated: true, userId: "u2", role: "PERSONAL" });
    const { PATCH } = await import("./route");
    expect((await PATCH(patch({ reminderHour: 7 }))).status).toBe(403);
  });
});
