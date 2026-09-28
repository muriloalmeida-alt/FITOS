import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PersonalOnboardingWizard } from "./PersonalOnboardingWizard";

const push = vi.fn();
const fetchMock = vi.fn();

const PLANS = [
  { id: "plan-20", name: "Personal 20", description: null, priceCents: 4990, billingCycle: "MENSAL", studentLimit: 20, trialDays: 30 },
  {
    id: "plan-ilimitado",
    name: "Personal Ilimitado",
    description: null,
    priceCents: 9990,
    billingCycle: "MENSAL",
    studentLimit: null,
    trialDays: 30,
  },
];

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

/// Avança da tela inicial até o passo 3 (seleção de plano), assumindo o
/// mesmo preenchimento válido usado pelos demais testes desta suíte.
async function advanceToStep3(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Celular"), "11912345678");
  await user.type(screen.getByLabelText("CPF ou CNPJ"), "11144477735");
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await user.selectOptions(await screen.findByLabelText("Quantos alunos você tem hoje, aproximadamente?"), "ATE_20");
  await user.click(screen.getByRole("checkbox"));
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await screen.findByText("Escolha seu plano");
}

describe("PersonalOnboardingWizard (FIT-113/FIT-126)", () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
  });

  it("passo 1: rejeita celular inválido, nunca avança para o passo 2", async () => {
    const user = userEvent.setup();
    render(<PersonalOnboardingWizard initialBusinessName="Espaço de Fulano" plans={PLANS} initialPlanId={null} />);

    await user.type(screen.getByLabelText("Celular"), "123");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByText("Informe um celular válido, com DDD.")).toBeInTheDocument();
    expect(screen.queryByText("Perfil profissional")).not.toBeInTheDocument();
  });

  it("aplica a máscara de celular ao digitar", async () => {
    const user = userEvent.setup();
    render(<PersonalOnboardingWizard initialBusinessName="Espaço de Fulano" plans={PLANS} initialPlanId={null} />);

    await user.type(screen.getByLabelText("Celular"), "11912345678");

    expect(screen.getByLabelText("Celular")).toHaveValue("(11) 91234-5678");
  });

  it("aplica a máscara de CPF/CNPJ ao digitar", async () => {
    const user = userEvent.setup();
    render(<PersonalOnboardingWizard initialBusinessName="Espaço de Fulano" plans={PLANS} initialPlanId={null} />);

    await user.type(screen.getByLabelText("CPF ou CNPJ"), "11144477735");

    expect(screen.getByLabelText("CPF ou CNPJ")).toHaveValue("111.444.777-35");
  });

  it("passo 1: rejeita CPF/CNPJ inválido, nunca avança para o passo 2", async () => {
    const user = userEvent.setup();
    render(<PersonalOnboardingWizard initialBusinessName="Espaço de Fulano" plans={PLANS} initialPlanId={null} />);

    await user.type(screen.getByLabelText("Celular"), "11912345678");
    await user.type(screen.getByLabelText("CPF ou CNPJ"), "11144477736");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByText("Informe um CPF ou CNPJ válido.")).toBeInTheDocument();
    expect(screen.queryByText("Perfil profissional")).not.toBeInTheDocument();
  });

  it("passo 3: exige um plano selecionado antes de ir para a revisão", async () => {
    const user = userEvent.setup();
    render(<PersonalOnboardingWizard initialBusinessName="Espaço de Fulano" plans={PLANS} initialPlanId={null} />);
    await advanceToStep3(user);

    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(screen.getByText("Escolha um plano para continuar.")).toBeInTheDocument();
    expect(screen.queryByText("Revisão")).not.toBeInTheDocument();
  });

  it("fluxo completo: passo 1 -> 2 -> 3 -> 4 -> submete com o plano escolhido e redireciona para o retorno da API", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ redirectTo: "/painel/alunos/novo" }) });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<PersonalOnboardingWizard initialBusinessName="Espaço de Fulano" plans={PLANS} initialPlanId={null} />);

    await user.type(screen.getByLabelText("Celular"), "11912345678");
    await user.type(screen.getByLabelText("CPF ou CNPJ"), "11144477735");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByText("Perfil profissional")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Quantos alunos você tem hoje, aproximadamente?"), "ATE_20");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByText("Escolha seu plano")).toBeInTheDocument();
    await user.click(screen.getByLabelText(/Personal 20/));
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByText("Revisão")).toBeInTheDocument();
    expect(screen.getByText("(11) 91234-5678")).toBeInTheDocument();
    expect(screen.getByText("111.444.777-35")).toBeInTheDocument();
    expect(screen.getByText("Até 20 alunos")).toBeInTheDocument();
    expect(screen.getByText("Personal 20 — R$ 49,90/mês (30 dias grátis)")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Concluir" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/onboarding-personal",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          phone: "(11) 91234-5678",
          cref: undefined,
          cpfCnpj: "111.444.777-35",
          studentRangeEstimate: "ATE_20",
          businessName: "Espaço de Fulano",
          termsAccepted: true,
          planId: "plan-20",
        }),
      })
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/painel/alunos/novo"));
  });

  it("passo 2: exige faixa de alunos, nome do espaço e aceite dos termos", async () => {
    const user = userEvent.setup();
    render(<PersonalOnboardingWizard initialBusinessName="" plans={PLANS} initialPlanId={null} />);

    await user.type(screen.getByLabelText("Celular"), "11912345678");
    await user.type(screen.getByLabelText("CPF ou CNPJ"), "11144477735");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    await user.click(await screen.findByRole("button", { name: "Continuar" }));

    expect(screen.getByText("Escolha uma faixa de alunos.")).toBeInTheDocument();
    expect(screen.getByText("Informe o nome do seu espaço/negócio.")).toBeInTheDocument();
    expect(screen.getByText("É necessário aceitar os termos para continuar.")).toBeInTheDocument();
  });

  it("Voltar do passo 2 retorna ao passo 1 preservando o celular já digitado", async () => {
    const user = userEvent.setup();
    render(<PersonalOnboardingWizard initialBusinessName="Espaço de Fulano" plans={PLANS} initialPlanId={null} />);

    await user.type(screen.getByLabelText("Celular"), "11912345678");
    await user.type(screen.getByLabelText("CPF ou CNPJ"), "11144477735");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await screen.findByText("Perfil profissional");

    await user.click(screen.getByRole("button", { name: "← Voltar" }));

    expect(screen.getByText("Dados complementares")).toBeInTheDocument();
    expect(screen.getByLabelText("Celular")).toHaveValue("(11) 91234-5678");
  });

  it("reabrir com uma assinatura existente pré-seleciona o mesmo plano", async () => {
    const user = userEvent.setup();
    render(<PersonalOnboardingWizard initialBusinessName="Espaço de Fulano" plans={PLANS} initialPlanId="plan-ilimitado" />);
    await advanceToStep3(user);

    expect(screen.getByLabelText(/Personal Ilimitado/)).toBeChecked();
  });

  it("mostra mensagem de erro quando a submissão falha, sem redirecionar", async () => {
    fetchMock.mockResolvedValue({ ok: false });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<PersonalOnboardingWizard initialBusinessName="Espaço de Fulano" plans={PLANS} initialPlanId={null} />);

    await advanceToStep3(user);
    await user.click(screen.getByLabelText(/Personal 20/));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(await screen.findByRole("button", { name: "Concluir" }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
