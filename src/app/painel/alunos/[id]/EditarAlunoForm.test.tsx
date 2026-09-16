import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditarAlunoForm } from "./EditarAlunoForm";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

describe("EditarAlunoForm", () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
  });

  it("mostra erro de validação quando o nome fica vazio", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const user = userEvent.setup();
    render(<EditarAlunoForm studentId="s1" initialName="Fulano" initialEmail="fulano@example.test" emailEditavel={true} />);

    await user.clear(screen.getByLabelText("Nome completo"));
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(await screen.findByText("Informe o nome do aluno.")).toBeInTheDocument();
  });

  it("salva com sucesso e mostra confirmação", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<EditarAlunoForm studentId="s1" initialName="Fulano" initialEmail="fulano@example.test" emailEditavel={true} />);

    await user.clear(screen.getByLabelText("Nome completo"));
    await user.type(screen.getByLabelText("Nome completo"), "Novo Nome");
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(await screen.findByText("Alterações salvas.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/students/s1",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ name: "Novo Nome", email: "fulano@example.test" }) })
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("desabilita o campo de e-mail e explica quando emailEditavel é falso", async () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<EditarAlunoForm studentId="s1" initialName="Fulano" initialEmail="fulano@example.test" emailEditavel={false} />);

    expect(screen.getByLabelText("E-mail")).toBeDisabled();
    expect(
      screen.getByText("Este aluno já ativou a conta — o e-mail de autenticação não pode ser alterado por aqui.")
    ).toBeInTheDocument();
  });

  it("mostra o erro do servidor quando a alteração é rejeitada", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "EMAIL_DUPLICADO_NO_TENANT", message: "Já existe um aluno com este e-mail na sua carteira." }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<EditarAlunoForm studentId="s1" initialName="Fulano" initialEmail="fulano@example.test" emailEditavel={true} />);

    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(await screen.findByText("Já existe um aluno com este e-mail na sua carteira.")).toBeInTheDocument();
  });
});
