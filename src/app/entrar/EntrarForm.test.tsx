import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const signInEmail = vi.fn();
const push = vi.fn();
const searchParamsGet = vi.fn().mockReturnValue(null);

vi.mock("@/modules/identity/auth-client", () => ({
  signIn: { email: (...args: unknown[]) => signInEmail(...args) },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => ({ get: searchParamsGet }),
}));

describe("EntrarForm", () => {
  afterEach(() => {
    vi.resetAllMocks();
    searchParamsGet.mockReturnValue(null);
  });

  it("mostra erros de validação quando os campos estão vazios", async () => {
    const { EntrarForm } = await import("./EntrarForm");
    const user = userEvent.setup();
    render(<EntrarForm />);

    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("Informe um e-mail válido.")).toBeInTheDocument();
    expect(screen.getByText("Informe sua senha.")).toBeInTheDocument();
    expect(signInEmail).not.toHaveBeenCalled();
  });

  it("mostra mensagem genérica para credenciais inválidas, sem revelar se o e-mail existe", async () => {
    signInEmail.mockResolvedValue({ error: { message: "Invalid password" } });
    const { EntrarForm } = await import("./EntrarForm");
    const user = userEvent.setup();
    render(<EntrarForm />);

    await user.type(screen.getByLabelText("E-mail"), "alguem@example.com");
    await user.type(screen.getByLabelText("Senha"), "senha-qualquer");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("E-mail ou senha inválidos.");
    expect(push).not.toHaveBeenCalled();
  });

  it("redireciona para /painel após login válido", async () => {
    signInEmail.mockResolvedValue({ error: null });
    const { EntrarForm } = await import("./EntrarForm");
    const user = userEvent.setup();
    render(<EntrarForm />);

    await user.type(screen.getByLabelText("E-mail"), "  Alguem@Example.com  ");
    await user.type(screen.getByLabelText("Senha"), "senha-correta-123");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() =>
      expect(signInEmail).toHaveBeenCalledWith({ email: "alguem@example.com", password: "senha-correta-123" })
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/painel"));
  });

  it("respeita o redirecionamento solicitado via parâmetro (?redirecionar=) quando é um caminho interno", async () => {
    signInEmail.mockResolvedValue({ error: null });
    searchParamsGet.mockReturnValue("/painel/configuracoes");
    const { EntrarForm } = await import("./EntrarForm");
    const user = userEvent.setup();
    render(<EntrarForm />);

    await user.type(screen.getByLabelText("E-mail"), "alguem@example.com");
    await user.type(screen.getByLabelText("Senha"), "senha-correta-123");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/painel/configuracoes"));
  });

  it("ignora redirecionamento que não seja um caminho interno (proteção contra open redirect)", async () => {
    signInEmail.mockResolvedValue({ error: null });
    searchParamsGet.mockReturnValue("https://evil.example.com");
    const { EntrarForm } = await import("./EntrarForm");
    const user = userEvent.setup();
    render(<EntrarForm />);

    await user.type(screen.getByLabelText("E-mail"), "alguem@example.com");
    await user.type(screen.getByLabelText("Senha"), "senha-correta-123");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/painel"));
  });
});
