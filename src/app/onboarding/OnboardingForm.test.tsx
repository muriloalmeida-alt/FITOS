import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OnboardingForm } from "./OnboardingForm";

const push = vi.fn();
const fetchMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

describe("OnboardingForm (FIT-101)", () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
  });

  it("mostra erros de validação e não envia quando nenhuma opção foi escolhida", async () => {
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<OnboardingForm initialObjective={null} initialExperienceLevel={null} initialWeeklyAvailability={null} />);

    await user.click(screen.getByRole("button", { name: "Concluir" }));

    expect(await screen.findByText("Escolha um objetivo.")).toBeInTheDocument();
    expect(screen.getByText("Escolha seu nível de experiência.")).toBeInTheDocument();
    expect(screen.getByText("Escolha sua disponibilidade.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("envia as três respostas e redireciona para /painel quando a resposta é ok", async () => {
    fetchMock.mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<OnboardingForm initialObjective={null} initialExperienceLevel={null} initialWeeklyAvailability={null} />);

    await user.selectOptions(screen.getByLabelText("Qual seu objetivo principal?"), "GANHAR_MASSA");
    await user.selectOptions(screen.getByLabelText("Qual sua experiência com treino?"), "INICIANTE");
    await user.selectOptions(screen.getByLabelText("Quantos dias por semana você pode treinar?"), "TRES_A_QUATRO_DIAS");
    await user.click(screen.getByRole("button", { name: "Concluir" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/onboarding",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          objective: "GANHAR_MASSA",
          experienceLevel: "INICIANTE",
          weeklyAvailability: "TRES_A_QUATRO_DIAS",
        }),
      })
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/painel"));
  });

  it("pré-seleciona as respostas já existentes (reabrir o onboarding)", () => {
    render(
      <OnboardingForm
        initialObjective="PERDER_PESO"
        initialExperienceLevel="AVANCADO"
        initialWeeklyAvailability="CINCO_OU_MAIS_DIAS"
      />
    );

    expect(screen.getByLabelText("Qual seu objetivo principal?")).toHaveValue("PERDER_PESO");
    expect(screen.getByLabelText("Qual sua experiência com treino?")).toHaveValue("AVANCADO");
    expect(screen.getByLabelText("Quantos dias por semana você pode treinar?")).toHaveValue("CINCO_OU_MAIS_DIAS");
  });

  it("mostra mensagem de erro quando a requisição falha", async () => {
    fetchMock.mockResolvedValue({ ok: false });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<OnboardingForm initialObjective={null} initialExperienceLevel={null} initialWeeklyAvailability={null} />);

    await user.selectOptions(screen.getByLabelText("Qual seu objetivo principal?"), "GANHAR_MASSA");
    await user.selectOptions(screen.getByLabelText("Qual sua experiência com treino?"), "INICIANTE");
    await user.selectOptions(screen.getByLabelText("Quantos dias por semana você pode treinar?"), "UM_A_DOIS_DIAS");
    await user.click(screen.getByRole("button", { name: "Concluir" }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
