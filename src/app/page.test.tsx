import { describe, expect, it, vi } from "vitest";

const getServerSession = vi.fn();

vi.mock("@/modules/identity/session", () => ({
  getServerSession: (...args: unknown[]) => getServerSession(...args),
}));

describe("RootPage (FIT-125, FIT-141)", () => {
  it("sem sessão: abre a tela de abertura com destino /entrar", async () => {
    getServerSession.mockResolvedValue(null);
    const { default: RootPage } = await import("./page");

    const element = await RootPage();
    expect(element.props.destination).toBe("/entrar");
  });

  it("com sessão: destino /painel, sem decidir o papel aqui (quem decide é /painel)", async () => {
    getServerSession.mockResolvedValue({ user: { id: "u1", email: "personal@example.test" } });
    const { default: RootPage } = await import("./page");

    const element = await RootPage();
    expect(element.props.destination).toBe("/painel");
  });
});
