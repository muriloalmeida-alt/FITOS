import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

describe("CadastrarAlunoForm", () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
  });

  it("mostra erros de validação e não envia quando os campos são inválidos", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { CadastrarAlunoForm } = await import("./CadastrarAlunoForm");
    const user = userEvent.setup();
    render(<CadastrarAlunoForm />);

    await user.click(screen.getByRole("button", { name: "Cadastrar aluno" }));

    expect(await screen.findByText("Informe o nome do aluno.")).toBeInTheDocument();
    expect(screen.getByText("Informe um e-mail válido.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("cadastra com sucesso e navega para a lista", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "s1" }) });
    vi.stubGlobal("fetch", fetchMock);
    const { CadastrarAlunoForm } = await import("./CadastrarAlunoForm");
    const user = userEvent.setup();
    render(<CadastrarAlunoForm />);

    await user.type(screen.getByLabelText("Nome completo"), "Fulano de Tal");
    await user.type(screen.getByLabelText("E-mail"), "Fulano@Example.TEST");
    await user.click(screen.getByRole("button", { name: "Cadastrar aluno" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/painel/alunos"));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/students",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "Fulano de Tal", email: "fulano@example.test" }),
      })
    );
  });

  it("mostra o erro do servidor quando o cadastro é rejeitado (ex.: e-mail duplicado)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "EMAIL_DUPLICADO_NO_TENANT", message: "Já existe um aluno com este e-mail na sua carteira." }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { CadastrarAlunoForm } = await import("./CadastrarAlunoForm");
    const user = userEvent.setup();
    render(<CadastrarAlunoForm />);

    await user.type(screen.getByLabelText("Nome completo"), "Fulano de Tal");
    await user.type(screen.getByLabelText("E-mail"), "duplicado@example.test");
    await user.click(screen.getByRole("button", { name: "Cadastrar aluno" }));

    expect(await screen.findByText("Já existe um aluno com este e-mail na sua carteira.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
