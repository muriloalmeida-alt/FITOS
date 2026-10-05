import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OnboardingForm } from "./OnboardingForm";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

const plans = [{ id: "livre", name: "FitOS Livre", description: null, priceCents: 1990, billingCycle: "MENSAL" as const, studentLimit: null, trialDays: 30 }];

function renderForm(overrides: Partial<Parameters<typeof OnboardingForm>[0]> = {}) {
  render(<OnboardingForm initialObjective={null} initialExperienceLevel={null} initialWeeklyAvailability={null} initialCpfCnpj={null} plans={plans} initialPlanId={null} {...overrides} />);
}

describe("OnboardingForm do FitOS Livre (FIT-167)", () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
  });

  it("exige as respostas em cartões antes de avançar", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByText("Escolha um objetivo.")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Ganhar massa muscular" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText("Escolha sua experiência.")).toBeInTheDocument();
  });

  it("fluxo completo leva direto a Montar meu primeiro treino; Voltar mantém as respostas", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("radio", { name: "Perder peso" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("radio", { name: "Iniciante" }));
    await user.click(screen.getByRole("radio", { name: "3 a 4 dias por semana" }));
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByRole("radio", { name: "Perder peso" })).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByRole("radio", { name: "Iniciante" })).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(screen.getByText(/primeira cobrança é em .*depois dos 30 dias grátis/)).toBeInTheDocument();
    await user.type(screen.getByLabelText("CPF ou CNPJ"), "11144477735");
    await user.type(screen.getByLabelText("Nome impresso no cartão"), "RAFA COSTA");
    await user.type(screen.getByLabelText("Número do cartão"), "4111111111111111");
    await user.type(screen.getByLabelText("Mês (MM)"), "12");
    await user.type(screen.getByLabelText("Ano (AAAA)"), "2031");
    await user.type(screen.getByLabelText("CVV"), "123");
    await user.type(screen.getByLabelText("CEP"), "01001000");
    await user.type(screen.getByLabelText("Número do endereço"), "100");
    await user.type(screen.getByLabelText("Celular"), "11987654321");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    await user.click(screen.getByRole("button", { name: "Montar meu primeiro treino" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/painel/meus-treinos/novo"));
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toMatchObject({ objective: "PERDER_PESO", experienceLevel: "INICIANTE", weeklyAvailability: "TRES_A_QUATRO_DIAS", planId: "livre", termsAccepted: true });
    expect(fetchMock.mock.calls[1]![0]).toBe("/api/tenancy/minha-assinatura/cartao");
  });
});
