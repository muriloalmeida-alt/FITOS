import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OnboardingForm } from "./OnboardingForm";

const push = vi.fn();
const fetchMock = vi.fn();

const PLANS = [
  { id: "plan-livre", name: "FitOS Livre", description: null, priceCents: 1990, billingCycle: "MENSAL", studentLimit: null, trialDays: 30 },
];

const PLANS_WITH_FREE = [
  ...PLANS,
  { id: "plan-livre-gratis", name: "FitOS Livre Grátis", description: null, priceCents: 0, billingCycle: "MENSAL", studentLimit: null, trialDays: null },
];

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

async function fillStep1AndAdvance(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText("Qual seu objetivo principal?"), "GANHAR_MASSA");
  await user.selectOptions(screen.getByLabelText("Qual sua experiência com treino?"), "INICIANTE");
  await user.selectOptions(screen.getByLabelText("Quantos dias por semana você pode treinar?"), "TRES_A_QUATRO_DIAS");
  await user.type(screen.getByLabelText("CPF ou CNPJ"), "11144477735");
  await user.click(screen.getByRole("button", { name: "Continuar" }));
}

/// Preenche os campos de cartão do checkout embutido (FIT-128) com dados
/// de teste válidos — o passo 2 exige cartão quando o plano escolhido é
/// pago (todo `PLANS` deste arquivo, exceto o plano sintético gratuito).
async function fillValidCardFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Nome impresso no cartão"), "Fulano de Tal");
  await user.type(screen.getByLabelText("Número do cartão"), "4111111111111111");
  await user.type(screen.getByLabelText("Mês (MM)"), "10");
  await user.type(screen.getByLabelText("Ano (AAAA)"), "2030");
  await user.type(screen.getByLabelText("CVV"), "123");
  await user.type(screen.getByLabelText("CEP"), "01310100");
  await user.type(screen.getByLabelText("Número do endereço"), "100");
  await user.type(screen.getByLabelText("Celular"), "11987654321");
}

describe("OnboardingForm (FIT-101/FIT-126)", () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
  });

  it("passo 1: mostra erros de validação e nunca avança para o passo 2 sem as respostas obrigatórias", async () => {
    const user = userEvent.setup();
    render(
      <OnboardingForm
        initialObjective={null}
        initialExperienceLevel={null}
        initialWeeklyAvailability={null}
        initialCpfCnpj={null}
        alreadyAcceptedTerms={false}
        plans={PLANS}
        initialPlanId={null}
      />
    );

    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByText("Escolha um objetivo.")).toBeInTheDocument();
    expect(screen.getByText("Escolha seu nível de experiência.")).toBeInTheDocument();
    expect(screen.getByText("Escolha sua disponibilidade.")).toBeInTheDocument();
    expect(screen.getByText("Informe um CPF ou CNPJ válido.")).toBeInTheDocument();
    expect(screen.queryByText(/dias grátis/)).not.toBeInTheDocument();
  });

  it("passo 1: rejeita CPF/CNPJ inválido, nunca avança para o passo 2", async () => {
    const user = userEvent.setup();
    render(
      <OnboardingForm
        initialObjective={null}
        initialExperienceLevel={null}
        initialWeeklyAvailability={null}
        initialCpfCnpj={null}
        alreadyAcceptedTerms={false}
        plans={PLANS}
        initialPlanId={null}
      />
    );

    await user.selectOptions(screen.getByLabelText("Qual seu objetivo principal?"), "GANHAR_MASSA");
    await user.selectOptions(screen.getByLabelText("Qual sua experiência com treino?"), "INICIANTE");
    await user.selectOptions(screen.getByLabelText("Quantos dias por semana você pode treinar?"), "TRES_A_QUATRO_DIAS");
    await user.type(screen.getByLabelText("CPF ou CNPJ"), "11144477736");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByText("Informe um CPF ou CNPJ válido.")).toBeInTheDocument();
    expect(screen.queryByText(/dias grátis/)).not.toBeInTheDocument();
  });

  it("passo 2: exige um plano selecionado e o aceite dos termos antes de concluir", async () => {
    const user = userEvent.setup();
    render(
      <OnboardingForm
        initialObjective={null}
        initialExperienceLevel={null}
        initialWeeklyAvailability={null}
        initialCpfCnpj={null}
        alreadyAcceptedTerms={false}
        plans={PLANS}
        initialPlanId={null}
      />
    );
    await fillStep1AndAdvance(user);

    await user.click(await screen.findByRole("button", { name: "Concluir" }));

    expect(screen.getByText("Escolha um plano para continuar.")).toBeInTheDocument();
    expect(screen.getByText("É necessário aceitar os termos para continuar.")).toBeInTheDocument();
  });

  it("fluxo completo: passo 1 -> 2 -> escolhe o plano, cadastra cartão, aceita os termos, envia e redireciona para /painel", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/onboarding") {
        return { ok: true };
      }
      return { ok: true, json: async () => ({ creditCardLast4: "1111", creditCardBrand: "VISA" }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(
      <OnboardingForm
        initialObjective={null}
        initialExperienceLevel={null}
        initialWeeklyAvailability={null}
        initialCpfCnpj={null}
        alreadyAcceptedTerms={false}
        plans={PLANS}
        initialPlanId={null}
      />
    );
    await fillStep1AndAdvance(user);

    await user.click(await screen.findByLabelText(/FitOS Livre/));
    expect(screen.getByText("Nome impresso no cartão")).toBeInTheDocument();
    await fillValidCardFields(user);
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Concluir" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/onboarding",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          objective: "GANHAR_MASSA",
          experienceLevel: "INICIANTE",
          weeklyAvailability: "TRES_A_QUATRO_DIAS",
          cpfCnpj: "111.444.777-35",
          termsAccepted: true,
          planId: "plan-livre",
        }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/tenancy/minha-assinatura/cartao", expect.objectContaining({ method: "POST" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/painel"));
  });

  it("um plano gratuito nunca mostra nem exige cartão", async () => {
    fetchMock.mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(
      <OnboardingForm
        initialObjective={null}
        initialExperienceLevel={null}
        initialWeeklyAvailability={null}
        initialCpfCnpj={null}
        alreadyAcceptedTerms={false}
        plans={PLANS_WITH_FREE}
        initialPlanId={null}
      />
    );
    await fillStep1AndAdvance(user);

    await user.click(await screen.findByLabelText(/FitOS Livre Grátis/));
    expect(screen.queryByText("Nome impresso no cartão")).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Concluir" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/painel"));
  });

  it("rejeita concluir com dados de cartão inválidos/incompletos quando o plano é pago", async () => {
    const user = userEvent.setup();
    render(
      <OnboardingForm
        initialObjective={null}
        initialExperienceLevel={null}
        initialWeeklyAvailability={null}
        initialCpfCnpj={null}
        alreadyAcceptedTerms={false}
        plans={PLANS}
        initialPlanId={null}
      />
    );
    await fillStep1AndAdvance(user);

    await user.click(await screen.findByLabelText(/FitOS Livre/));
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Concluir" }));

    expect(await screen.findByText("Informe um número de cartão válido.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("Voltar do passo 2 retorna ao passo 1 preservando as respostas já escolhidas", async () => {
    const user = userEvent.setup();
    render(
      <OnboardingForm
        initialObjective={null}
        initialExperienceLevel={null}
        initialWeeklyAvailability={null}
        initialCpfCnpj={null}
        alreadyAcceptedTerms={false}
        plans={PLANS}
        initialPlanId={null}
      />
    );
    await fillStep1AndAdvance(user);
    await screen.findByRole("button", { name: "← Voltar" });

    await user.click(screen.getByRole("button", { name: "← Voltar" }));

    expect(screen.getByLabelText("Qual seu objetivo principal?")).toHaveValue("GANHAR_MASSA");
    expect(screen.getByLabelText("CPF ou CNPJ")).toHaveValue("111.444.777-35");
  });

  it("pré-seleciona as respostas, o CPF/CNPJ e o plano já existentes (reabrir o onboarding)", async () => {
    render(
      <OnboardingForm
        initialObjective="PERDER_PESO"
        initialExperienceLevel="AVANCADO"
        initialWeeklyAvailability="CINCO_OU_MAIS_DIAS"
        initialCpfCnpj="111.444.777-35"
        alreadyAcceptedTerms={false}
        plans={PLANS}
        initialPlanId="plan-livre"
      />
    );

    expect(screen.getByLabelText("Qual seu objetivo principal?")).toHaveValue("PERDER_PESO");
    expect(screen.getByLabelText("Qual sua experiência com treino?")).toHaveValue("AVANCADO");
    expect(screen.getByLabelText("Quantos dias por semana você pode treinar?")).toHaveValue("CINCO_OU_MAIS_DIAS");
    expect(screen.getByLabelText("CPF ou CNPJ")).toHaveValue("111.444.777-35");
  });

  it("FIT-119: quando os termos já foram aceitos antes, o checkbox aparece marcado e desabilitado, sem exigir novo aceite", async () => {
    fetchMock.mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(
      <OnboardingForm
        initialObjective="PERDER_PESO"
        initialExperienceLevel="AVANCADO"
        initialWeeklyAvailability="CINCO_OU_MAIS_DIAS"
        initialCpfCnpj="111.444.777-35"
        alreadyAcceptedTerms
        plans={PLANS}
        initialPlanId="plan-livre"
      />
    );
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    const checkbox = await screen.findByRole("checkbox");
    expect(checkbox).toBeChecked();
    expect(checkbox).toBeDisabled();

    await fillValidCardFields(user);
    await user.click(screen.getByRole("button", { name: "Concluir" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/onboarding",
      expect.objectContaining({ body: expect.stringContaining('"termsAccepted":true') })
    );
  });

  it("mostra mensagem de erro quando a requisição falha, sem redirecionar", async () => {
    fetchMock.mockResolvedValue({ ok: false });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(
      <OnboardingForm
        initialObjective={null}
        initialExperienceLevel={null}
        initialWeeklyAvailability={null}
        initialCpfCnpj={null}
        alreadyAcceptedTerms={false}
        plans={PLANS}
        initialPlanId={null}
      />
    );
    await fillStep1AndAdvance(user);
    await user.click(await screen.findByLabelText(/FitOS Livre/));
    await fillValidCardFields(user);
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Concluir" }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("mostra mensagem de erro quando o checkout de cartão falha, sem redirecionar", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/onboarding") {
        return { ok: true };
      }
      return { ok: false, json: async () => ({ error: "CARTAO_RECUSADO", message: "Cartão de crédito inválido." }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(
      <OnboardingForm
        initialObjective={null}
        initialExperienceLevel={null}
        initialWeeklyAvailability={null}
        initialCpfCnpj={null}
        alreadyAcceptedTerms={false}
        plans={PLANS}
        initialPlanId={null}
      />
    );
    await fillStep1AndAdvance(user);
    await user.click(await screen.findByLabelText(/FitOS Livre/));
    await fillValidCardFields(user);
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Concluir" }));

    expect(await screen.findByText("Cartão de crédito inválido.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
