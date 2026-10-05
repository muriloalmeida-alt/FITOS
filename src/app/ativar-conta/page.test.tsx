import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const checkActivationToken = vi.fn();

vi.mock("@/modules/identity/activation", async () => {
  const actual = await vi.importActual<typeof import("@/modules/identity/activation")>(
    "@/modules/identity/activation"
  );
  return { ...actual, checkActivationToken: (...args: unknown[]) => checkActivationToken(...args) };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("AtivarContaPage (FIT-165)", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  async function renderPage(token?: string) {
    const { default: Page } = await import("./page");
    render(await Page({ searchParams: Promise.resolve(token ? { token } : {}) }));
  }

  it("sem token: convite inexistente, com as duas saídas, sem consultar o domínio", async () => {
    await renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Convite inválido" })).toBeInTheDocument();
    expect(checkActivationToken).not.toHaveBeenCalled();
  });

  it("expirado mostra o motivo e as saídas Já tenho conta e Treinar por conta própria", async () => {
    checkActivationToken.mockResolvedValue({ valid: false, reason: "EXPIRADO" });
    await renderPage("t1");
    expect(screen.getByRole("heading", { level: 1, name: "Convite expirado" })).toBeInTheDocument();
    expect(screen.getByText(/valem 7 dias/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Já tenho conta" })).toHaveAttribute("href", "/entrar");
    expect(screen.getByRole("link", { name: "Treinar por conta própria" })).toHaveAttribute("href", "/comecar?caminho=livre");
  });

  it("cancelado tem mensagem própria", async () => {
    checkActivationToken.mockResolvedValue({ valid: false, reason: "CANCELADO" });
    await renderPage("t1");
    expect(screen.getByRole("heading", { level: 1, name: "Convite cancelado" })).toBeInTheDocument();
  });

  it("válido: quem convidou, e-mail fixo e só a senha", async () => {
    checkActivationToken.mockResolvedValue({ valid: true, studentName: "Pedro Lima", email: "pedro@example.test", personalName: "Joana Lima", businessName: "Studio Joana" });
    await renderPage("t1");
    expect(screen.getByRole("heading", { level: 1, name: "Oi, Pedro." })).toBeInTheDocument();
    expect(screen.getByText("Joana Lima")).toBeInTheDocument();
    expect(screen.getByText(/Studio Joana te convidou/)).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toHaveValue("pedro@example.test");
    expect(screen.getByLabelText("E-mail")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Crie sua senha")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Confirmar senha/)).not.toBeInTheDocument();
  });
});
