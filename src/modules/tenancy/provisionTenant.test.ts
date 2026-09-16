import { afterEach, describe, expect, it, vi } from "vitest";

const getServerSession = vi.fn();
const ensureTenantForPersonal = vi.fn();

vi.mock("@/modules/identity/session", () => ({
  getServerSession: (...args: unknown[]) => getServerSession(...args),
}));

vi.mock("./ensureTenantForPersonal", () => ({
  ensureTenantForPersonal: (...args: unknown[]) => ensureTenantForPersonal(...args),
}));

describe("provisionTenantForCurrentSession", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna null e não toca o banco quando não há sessão (usuário não autenticado)", async () => {
    getServerSession.mockResolvedValue(null);
    const { provisionTenantForCurrentSession } = await import("./provisionTenant");

    const result = await provisionTenantForCurrentSession();

    expect(result).toBeNull();
    expect(ensureTenantForPersonal).not.toHaveBeenCalled();
  });

  it("retorna null e não toca o banco quando o usuário autenticado é ALUNO", async () => {
    getServerSession.mockResolvedValue({ user: { id: "u1", name: "Aluno", role: "ALUNO" } });
    const { provisionTenantForCurrentSession } = await import("./provisionTenant");

    const result = await provisionTenantForCurrentSession();

    expect(result).toBeNull();
    expect(ensureTenantForPersonal).not.toHaveBeenCalled();
  });

  it("provisiona o tenant a partir do usuário PERSONAL da sessão, sem aceitar nenhum parâmetro externo", async () => {
    const sessionUser = { id: "u2", name: "Personal", role: "PERSONAL" };
    getServerSession.mockResolvedValue({ user: sessionUser });
    ensureTenantForPersonal.mockResolvedValue({ id: "t1", ownerId: "u2", name: "Espaço de Personal" });
    const { provisionTenantForCurrentSession } = await import("./provisionTenant");

    const result = await provisionTenantForCurrentSession();

    expect(ensureTenantForPersonal).toHaveBeenCalledWith(sessionUser);
    expect(result).toEqual({ id: "t1", ownerId: "u2", name: "Espaço de Personal" });
  });
});
