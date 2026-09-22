import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const signUpEmail = vi.fn();
const push = vi.fn();

vi.mock("@/modules/identity/auth-client", () => ({
  signUp: { email: (...args: unknown[]) => signUpEmail(...args) },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

describe("CriarContaForm", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("mostra erros de validação e não envia quando os campos são inválidos", async () => {
    const { CriarContaForm } = await import("./CriarContaForm");
    const user = userEvent.setup();
    render(<CriarContaForm />);

    await user.click(screen.getByRole("button", { name: "Criar conta" }));

    expect(await screen.findByText("Informe seu nome completo.")).toBeInTheDocument();
    expect(screen.getByText("Informe um e-mail válido.")).toBeInTheDocument();
    expect(signUpEmail).not.toHaveBeenCalled();
  });

  it("rejeita senhas que não coincidem", async () => {
    const { CriarContaForm } = await import("./CriarContaForm");
    const user = userEvent.setup();
    render(<CriarContaForm />);

    await user.type(screen.getByLabelText("Nome completo"), "Fulano de Tal");
    await user.type(screen.getByLabelText("E-mail"), "fulano@example.com");
    await user.type(screen.getByLabelText("Senha"), "senha12345");
    await user.type(screen.getByLabelText("Confirmar senha"), "outra-senha");
    await user.click(screen.getByRole("button", { name: "Criar conta" }));

    expect(await screen.findByText("As senhas não coincidem.")).toBeInTheDocument();
    expect(signUpEmail).not.toHaveBeenCalled();
  });

  it("normaliza o e-mail (trim + minúsculas) e envia ao provedor quando os dados são válidos", async () => {
    signUpEmail.mockResolvedValue({ error: null });
    const { CriarContaForm } = await import("./CriarContaForm");
    const user = userEvent.setup();
    render(<CriarContaForm />);

    await user.type(screen.getByLabelText("Nome completo"), "Fulano de Tal");
    await user.type(screen.getByLabelText("E-mail"), "  Fulano@Example.com  ");
    await user.type(screen.getByLabelText("Senha"), "senha12345");
    await user.type(screen.getByLabelText("Confirmar senha"), "senha12345");
    await user.click(screen.getByRole("button", { name: "Criar conta" }));

    await waitFor(() => expect(signUpEmail).toHaveBeenCalledTimes(1));
    expect(signUpEmail).toHaveBeenCalledWith({
      name: "Fulano de Tal",
      email: "fulano@example.com",
      password: "senha12345",
      role: "PERSONAL",
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/painel"));
  });

  it("FIT-101: modo individual envia role=INDIVIDUAL e redireciona para /onboarding", async () => {
    signUpEmail.mockResolvedValue({ error: null });
    const { CriarContaForm } = await import("./CriarContaForm");
    const user = userEvent.setup();
    render(<CriarContaForm mode="individual" />);

    await user.type(screen.getByLabelText("Nome completo"), "Praticante Sozinho");
    await user.type(screen.getByLabelText("E-mail"), "praticante@example.com");
    await user.type(screen.getByLabelText("Senha"), "senha12345");
    await user.type(screen.getByLabelText("Confirmar senha"), "senha12345");
    await user.click(screen.getByRole("button", { name: "Criar conta" }));

    await waitFor(() => expect(signUpEmail).toHaveBeenCalledTimes(1));
    expect(signUpEmail).toHaveBeenCalledWith({
      name: "Praticante Sozinho",
      email: "praticante@example.com",
      password: "senha12345",
      role: "INDIVIDUAL",
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/onboarding"));
  });

  it("FIT-112: Voltar sem dados preenchidos navega direto para a etapa 1, sem confirmação", async () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    const { CriarContaForm } = await import("./CriarContaForm");
    const user = userEvent.setup();
    render(<CriarContaForm />);

    await user.click(screen.getByRole("button", { name: "← Voltar" }));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/criar-conta");
  });

  it("FIT-112: Voltar com dados preenchidos pede confirmação; cancelar não navega", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { CriarContaForm } = await import("./CriarContaForm");
    const user = userEvent.setup();
    render(<CriarContaForm />);

    await user.type(screen.getByLabelText("Nome completo"), "Fulano de Tal");
    await user.click(screen.getByRole("button", { name: "← Voltar" }));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
  });

  it("FIT-112: Voltar com dados preenchidos e confirmação aceita navega para a etapa 1", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { CriarContaForm } = await import("./CriarContaForm");
    const user = userEvent.setup();
    render(<CriarContaForm />);

    await user.type(screen.getByLabelText("Nome completo"), "Fulano de Tal");
    await user.click(screen.getByRole("button", { name: "← Voltar" }));

    expect(push).toHaveBeenCalledWith("/criar-conta");
  });

  it("mostra mensagem genérica de erro quando o cadastro falha, sem revelar o motivo exato", async () => {
    signUpEmail.mockResolvedValue({ error: { message: "User already exists" } });
    const { CriarContaForm } = await import("./CriarContaForm");
    const user = userEvent.setup();
    render(<CriarContaForm />);

    await user.type(screen.getByLabelText("Nome completo"), "Fulano de Tal");
    await user.type(screen.getByLabelText("E-mail"), "fulano@example.com");
    await user.type(screen.getByLabelText("Senha"), "senha12345");
    await user.type(screen.getByLabelText("Confirmar senha"), "senha12345");
    await user.click(screen.getByRole("button", { name: "Criar conta" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).not.toMatch(/already exists/i);
    expect(push).not.toHaveBeenCalled();
  });
});
