import { describe, expect, it, vi } from "vitest";

const getServerSession = vi.fn();
const redirect = vi.fn((_url: string) => {
  throw new Error("NEXT_REDIRECT");
});

vi.mock("@/modules/identity/session", () => ({
  getServerSession: (...args: unknown[]) => getServerSession(...args),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
}));

describe("RootPage (FIT-125)", () => {
  it("sem sessão: redireciona para /entrar", async () => {
    getServerSession.mockResolvedValue(null);
    const { default: RootPage } = await import("./page");

    await expect(RootPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/entrar");
  });

  it("com sessão: redireciona para /painel, sem decidir o papel aqui (quem decide é /painel)", async () => {
    getServerSession.mockResolvedValue({ user: { id: "u1", email: "personal@example.test" } });
    const { default: RootPage } = await import("./page");

    await expect(RootPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/painel");
  });
});
