import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { IndividualHome } from "./IndividualHome";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/modules/identity/auth-client", () => ({
  signOut: vi.fn(),
}));

const BASE_PROPS = {
  name: "Marina",
  tenantName: "Espaço de Marina",
  objective: "GANHAR_MASSA" as const,
  experienceLevel: "INTERMEDIARIO" as const,
  weeklyAvailability: "TRES_A_QUATRO_DIAS" as const,
  workoutsCount: 2,
  inProgressWorkoutName: null,
  suggestedWorkout: null,
  weeklyRhythm: { completedDays: 0, dayFlags: [false, false, false, false, false, false, false] },
  subscription: null,
};

describe("IndividualHome (FIT-137 — tela-10 do pacote visual 2026)", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("sem treino em andamento e sem nenhum treino criado: hero convida a criar o primeiro, nunca finge que há algo para começar", () => {
    render(<IndividualHome {...BASE_PROPS} />);

    expect(screen.getByText("Treine no seu próprio ritmo.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Criar meu primeiro treino" })).toHaveAttribute("href", "/painel/meus-treinos/novo");
    expect(screen.queryByText("Hoje para você")).not.toBeInTheDocument();
  });

  it("com treino real sugerido (sem sessão em andamento): hero leva ao treino real, 'Hoje para você' mostra o preview real", () => {
    render(
      <IndividualHome
        {...BASE_PROPS}
        suggestedWorkout={{ id: "w1", name: "Força essencial", exercisesCount: 5 }}
      />
    );

    expect(screen.getByRole("link", { name: "Iniciar treino" })).toHaveAttribute("href", "/painel/meus-treinos/w1");
    expect(screen.getByText("Hoje para você")).toBeInTheDocument();
    expect(screen.getByText("Força essencial")).toBeInTheDocument();
    expect(screen.getByText("5 exercícios")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver treino ↗" })).toHaveAttribute("href", "/painel/meus-treinos/w1");
  });

  it("com sessão em andamento: hero mostra 'Continuar treino', 'Hoje para você' não aparece (evita duplicar o mesmo treino)", () => {
    render(
      <IndividualHome
        {...BASE_PROPS}
        inProgressWorkoutName="Força essencial"
        suggestedWorkout={{ id: "w1", name: "Força essencial", exercisesCount: 5 }}
      />
    );

    expect(screen.getByRole("link", { name: "Continuar treino" })).toBeInTheDocument();
    expect(screen.queryByText("Hoje para você")).not.toBeInTheDocument();
  });

  it("'Sua evolução' mostra a contagem real de treinos concluídos nesta semana, sempre visível mesmo em zero", () => {
    render(<IndividualHome {...BASE_PROPS} weeklyRhythm={{ completedDays: 3, dayFlags: [true, true, true, false, false, false, false] }} />);

    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("treinos nesta semana")).toBeInTheDocument();
  });

  it("'Seu plano' só aparece com assinatura real — período grátis ativo mostra a data real de fim do trial", () => {
    const { rerender } = render(<IndividualHome {...BASE_PROPS} />);
    expect(screen.queryByText("Seu plano")).not.toBeInTheDocument();

    const trialEndsAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    rerender(
      <IndividualHome
        {...BASE_PROPS}
        subscription={{ planName: "FitOS Livre", priceCents: 1990, trialEndsAt }}
      />
    );

    expect(screen.getByText("Seu plano")).toBeInTheDocument();
    expect(screen.getByText("FitOS Livre")).toBeInTheDocument();
    expect(screen.getByText(/Período grátis até/)).toBeInTheDocument();
    expect(screen.getByText(/R\$ 19,90\/mês/)).toBeInTheDocument();
  });

  it("'Seu plano' com trial já encerrado mostra só o preço mensal, sem menção a período grátis", () => {
    const trialEndsAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    render(
      <IndividualHome
        {...BASE_PROPS}
        subscription={{ planName: "FitOS Livre", priceCents: 1990, trialEndsAt }}
      />
    );

    expect(screen.getByText("R$ 19,90/mês")).toBeInTheDocument();
    expect(screen.queryByText(/Período grátis/)).not.toBeInTheDocument();
  });
});
