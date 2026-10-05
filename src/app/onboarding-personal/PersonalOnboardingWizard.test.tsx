import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PersonalOnboardingWizard, suggestPlan, type OnboardingPlan } from "./PersonalOnboardingWizard";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

const plans: OnboardingPlan[] = [
  { id: "p20", name: "Personal 20", description: null, priceCents: 4990, billingCycle: "MENSAL", studentLimit: 20, trialDays: 30 },
  { id: "p50", name: "Personal 50", description: null, priceCents: 6990, billingCycle: "MENSAL", studentLimit: 50, trialDays: 30 },
  { id: "pil", name: "Personal Ilimitado", description: null, priceCents: 9990, billingCycle: "MENSAL", studentLimit: null, trialDays: 30 },
];

async function step1(user: ReturnType<typeof userEvent.setup>, range = "De 21 a 50 alunos") {
  await user.clear(screen.getByLabelText("Nome do espaço"));
  await user.type(screen.getByLabelText("Nome do espaço"), "Studio Joana");
  await user.click(screen.getByRole("radio", { name: range }));
  await user.type(screen.getByLabelText("Celular"), "11987654321");
  await user.click(screen.getByRole("button", { name: "Continuar" }));
}

describe("PersonalOnboardingWizard (FIT-166)", () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
  });

  it("sugere o plano pela faixa de alunos", () => {
    expect(suggestPlan(plans, "ATE_20")?.id).toBe("p20");
    expect(suggestPlan(plans, "DE_21_A_50")?.id).toBe("p50");
    expect(suggestPlan(plans, "MAIS_DE_50")?.id).toBe("pil");
  });

  it("passo 1 valida celular e faixa antes de avançar", async () => {
    const user = userEvent.setup();
    render(<PersonalOnboardingWizard initialBusinessName="Espaço de Joana" plans={plans} initialPlanId={null} />);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByText("Escolha quantos alunos você atende.")).toBeInTheDocument();
    expect(screen.getByText("Informe um celular válido, com DDD.")).toBeInTheDocument();
    expect(screen.getByText(/Passo 1 de 4/)).toBeInTheDocument();
  });

  it("fluxo completo: plano sugerido, pagamento com data da primeira cobrança, revisão e 30 dias grátis", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ redirectTo: "/painel" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<PersonalOnboardingWizard initialBusinessName="Espaço de Joana" plans={plans} initialPlanId={null} />);
    await step1(user);

    expect(screen.getByRole("radio", { name: /Personal 50 Sugerido/ })).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(screen.getByText(/primeira cobrança de R\$\s69,90 é em .*depois dos 30 dias grátis/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Celular")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("CPF ou CNPJ"), "11144477735");
    await user.type(screen.getByLabelText("Nome impresso no cartão"), "JOANA LIMA");
    await user.type(screen.getByLabelText("Número do cartão"), "4111111111111111");
    await user.type(screen.getByLabelText("Mês (MM)"), "12");
    await user.type(screen.getByLabelText("Ano (AAAA)"), "2031");
    await user.type(screen.getByLabelText("CVV"), "123");
    await user.type(screen.getByLabelText("CEP"), "01001000");
    await user.type(screen.getByLabelText("Número do endereço"), "100");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(screen.getByText("Studio Joana")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Começar meus 30 dias grátis" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/painel"));
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body).toMatchObject({ businessName: "Studio Joana", studentRangeEstimate: "DE_21_A_50", planId: "p50", termsAccepted: true, cpfCnpj: "111.444.777-35" });
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body).phone).toBe("(11) 98765-4321");
  });

  it("Voltar mantém os dados", async () => {
    const user = userEvent.setup();
    render(<PersonalOnboardingWizard initialBusinessName="Espaço" plans={plans} initialPlanId={null} />);
    await step1(user, "Até 20 alunos");
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByLabelText("Celular")).toHaveValue("(11) 98765-4321");
    expect(screen.getByRole("radio", { name: "Até 20 alunos" })).toHaveAttribute("aria-checked", "true");
  });
});
