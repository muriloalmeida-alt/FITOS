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
  inProgressWorkoutName: null,
  suggestedWorkout: null,
  weeklyRhythm: { completedDays: 0, dayFlags: [false, false, false, false, false, false, false] },
};

describe("IndividualHome (FIT-137/FIT-142 — tela-10 do pacote visual 2026)", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("sem treino em andamento e sem nenhum treino criado: hero convida a criar o primeiro, nunca finge que há algo para começar", () => {
    render(<IndividualHome {...BASE_PROPS} />);

    expect(screen.getByText("Nenhum treino criado ainda")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Criar meu primeiro treino" })).toHaveAttribute("href", "/painel/meus-treinos/novo");
    expect(screen.queryByText("Hoje para você")).not.toBeInTheDocument();
  });

  it("com treino real sugerido (sem sessão em andamento): hero mostra o nome/contagem reais do treino, 'Hoje para você' mostra o mesmo preview real", () => {
    render(
      <IndividualHome
        {...BASE_PROPS}
        suggestedWorkout={{ id: "w1", name: "Força essencial", exercisesCount: 5 }}
      />
    );

    expect(screen.getByRole("link", { name: "Iniciar treino" })).toHaveAttribute("href", "/painel/meus-treinos/w1");
    expect(screen.getByText("Hoje para você")).toBeInTheDocument();
    expect(screen.getAllByText("Força essencial")).toHaveLength(2);
    expect(screen.getAllByText("5 exercícios")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Ver treino ↗" })).toHaveAttribute("href", "/painel/meus-treinos/w1");
  });

  it("FIT-142: nunca mostra o texto motivacional genérico antigo", () => {
    const { rerender } = render(<IndividualHome {...BASE_PROPS} />);
    expect(screen.queryByText(/Treine no seu próprio ritmo/)).not.toBeInTheDocument();
    expect(screen.queryByText(/no seu tempo, do seu jeito/)).not.toBeInTheDocument();

    rerender(<IndividualHome {...BASE_PROPS} suggestedWorkout={{ id: "w1", name: "Força essencial", exercisesCount: 5 }} />);
    expect(screen.queryByText(/Treine no seu próprio ritmo/)).not.toBeInTheDocument();
    expect(screen.queryByText(/no seu tempo, do seu jeito/)).not.toBeInTheDocument();
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

  it("FIT-142: nunca mostra os cards removidos 'Seu plano', 'Seu espaço' ou 'Meus treinos' (agora em /painel/perfil)", () => {
    render(<IndividualHome {...BASE_PROPS} />);

    expect(screen.queryByText("Seu plano")).not.toBeInTheDocument();
    expect(screen.queryByText("Seu espaço")).not.toBeInTheDocument();
    expect(screen.queryByText("Meus treinos")).not.toBeInTheDocument();
  });

  it("saudação e data reais aparecem no cabeçalho quando informadas pelo servidor", () => {
    render(<IndividualHome {...BASE_PROPS} greeting="Bom dia" dateLabel="Terça, 29 de setembro" />);

    expect(screen.getByRole("heading", { name: "Bom dia, Marina." })).toBeInTheDocument();
    expect(screen.getByText("Terça, 29 de setembro")).toBeInTheDocument();
  });
});
