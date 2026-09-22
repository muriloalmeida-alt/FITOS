import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PersonalOnboardingWizard } from "./PersonalOnboardingWizard";

const push = vi.fn();
const fetchMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

describe("PersonalOnboardingWizard (FIT-113)", () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
  });

  it("passo 1: rejeita celular inválido, nunca avança para o passo 2", async () => {
    const user = userEvent.setup();
    render(<PersonalOnboardingWizard initialBusinessName="Espaço de Fulano" />);

    await user.type(screen.getByLabelText("Celular"), "123");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByText("Informe um celular válido, com DDD.")).toBeInTheDocument();
    expect(screen.queryByText("Perfil profissional")).not.toBeInTheDocument();
  });

  it("aplica a máscara de celular ao digitar", async () => {
    const user = userEvent.setup();
    render(<PersonalOnboardingWizard initialBusinessName="Espaço de Fulano" />);

    await user.type(screen.getByLabelText("Celular"), "11912345678");

    expect(screen.getByLabelText("Celular")).toHaveValue("(11) 91234-5678");
  });

  it("fluxo completo: passo 1 -> 2 -> 3 -> submete e redireciona para o retorno da API", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ redirectTo: "/painel/alunos/novo" }) });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<PersonalOnboardingWizard initialBusinessName="Espaço de Fulano" />);

    await user.type(screen.getByLabelText("Celular"), "11912345678");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByText("Perfil profissional")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Quantos alunos você tem hoje, aproximadamente?"), "ATE_20");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByText("Revisão")).toBeInTheDocument();
    expect(screen.getByText("(11) 91234-5678")).toBeInTheDocument();
    expect(screen.getByText("Até 20 alunos")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Concluir" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/onboarding-personal",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          phone: "(11) 91234-5678",
          cref: undefined,
          studentRangeEstimate: "ATE_20",
          businessName: "Espaço de Fulano",
          termsAccepted: true,
        }),
      })
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/painel/alunos/novo"));
  });

  it("passo 2: exige faixa de alunos, nome do espaço e aceite dos termos", async () => {
    const user = userEvent.setup();
    render(<PersonalOnboardingWizard initialBusinessName="" />);

    await user.type(screen.getByLabelText("Celular"), "11912345678");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    await user.click(await screen.findByRole("button", { name: "Continuar" }));

    expect(screen.getByText("Escolha uma faixa de alunos.")).toBeInTheDocument();
    expect(screen.getByText("Informe o nome do seu espaço/negócio.")).toBeInTheDocument();
    expect(screen.getByText("É necessário aceitar os termos para continuar.")).toBeInTheDocument();
  });

  it("Voltar do passo 2 retorna ao passo 1 preservando o celular já digitado", async () => {
    const user = userEvent.setup();
    render(<PersonalOnboardingWizard initialBusinessName="Espaço de Fulano" />);

    await user.type(screen.getByLabelText("Celular"), "11912345678");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await screen.findByText("Perfil profissional");

    await user.click(screen.getByRole("button", { name: "← Voltar" }));

    expect(screen.getByText("Dados complementares")).toBeInTheDocument();
    expect(screen.getByLabelText("Celular")).toHaveValue("(11) 91234-5678");
  });

  it("mostra mensagem de erro quando a submissão falha, sem redirecionar", async () => {
    fetchMock.mockResolvedValue({ ok: false });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<PersonalOnboardingWizard initialBusinessName="Espaço de Fulano" />);

    await user.type(screen.getByLabelText("Celular"), "11912345678");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.selectOptions(await screen.findByLabelText("Quantos alunos você tem hoje, aproximadamente?"), "ATE_20");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(await screen.findByRole("button", { name: "Concluir" }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
