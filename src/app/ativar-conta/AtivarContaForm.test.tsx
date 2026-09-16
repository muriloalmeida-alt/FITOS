import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

describe("AtivarContaForm", () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
  });

  it("mostra erros de validação para senha curta e senhas divergentes", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const { AtivarContaForm } = await import("./AtivarContaForm");
    const user = userEvent.setup();
    render(<AtivarContaForm token="token-de-teste" />);

    await user.type(screen.getByLabelText("Senha"), "curta");
    await user.type(screen.getByLabelText("Confirmar senha"), "outra-coisa");
    await user.click(screen.getByRole("button", { name: "Ativar conta" }));

    expect(await screen.findByText("A senha deve ter pelo menos 8 caracteres.")).toBeInTheDocument();
    expect(screen.getByText("As senhas não coincidem.")).toBeInTheDocument();
  });

  it("ativa com sucesso e navega para /painel", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);
    const { AtivarContaForm } = await import("./AtivarContaForm");
    const user = userEvent.setup();
    render(<AtivarContaForm token="token-de-teste" />);

    await user.type(screen.getByLabelText("Senha"), "senha-valida-123");
    await user.type(screen.getByLabelText("Confirmar senha"), "senha-valida-123");
    await user.click(screen.getByRole("button", { name: "Ativar conta" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ativar-conta",
      expect.objectContaining({ body: JSON.stringify({ token: "token-de-teste", password: "senha-valida-123" }) })
    );
    expect(push).toHaveBeenCalledWith("/painel");
  });

  it("mostra o erro do servidor quando o token é rejeitado", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "TOKEN_INVALIDO", message: "Este link não é válido ou já expirou." }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { AtivarContaForm } = await import("./AtivarContaForm");
    const user = userEvent.setup();
    render(<AtivarContaForm token="token-de-teste" />);

    await user.type(screen.getByLabelText("Senha"), "senha-valida-123");
    await user.type(screen.getByLabelText("Confirmar senha"), "senha-valida-123");
    await user.click(screen.getByRole("button", { name: "Ativar conta" }));

    expect(await screen.findByText("Este link não é válido ou já expirou.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
