import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { IndividualHome as Data } from "@/modules/workouts/individualHome";
import { IndividualHome } from "./IndividualHome";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/modules/identity/auth-client", () => ({ signOut: vi.fn() }));

const workout = { id: "w1", name: "Superiores A", exercises: 5, estimatedMinutes: 40, days: ["SEGUNDA", "QUINTA"] };
const base: Data = {
  today: { ...workout, reason: "dia" },
  inProgress: null,
  workouts: [workout, { id: "w2", name: "Rascunho", exercises: 0, estimatedMinutes: 5, days: [] }],
  week: { done: [true, false, false, false, false, false, false], doneCount: 1, target: 4 },
  monthSessions: 7,
  activeGoals: 2,
};

function renderHome(home: Partial<Data> = {}) {
  render(<IndividualHome name="Rafa Costa" greeting="Bom dia" dateLabel="Segunda, 5 de outubro" home={{ ...base, ...home }} todayIso="2026-10-05T12:00:00.000Z" />);
}

describe("IndividualHome (FIT-156)", () => {
  it("hoje para você inicia o treino do dia, com semana, treinos e evolução", () => {
    renderHome();
    expect(screen.getByRole("heading", { level: 1, name: "Bom dia, Rafa." })).toBeInTheDocument();
    expect(screen.getByText("Hoje para você")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Iniciar treino" })).toHaveAttribute("href", "/painel/meus-treinos/sessao?treino=w1");
    expect(screen.getByText("1 de 4 treinos")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Iniciar Superiores A" })).toHaveAttribute("href", "/painel/meus-treinos/sessao?treino=w1");
    expect(screen.getByRole("link", { name: "Montar Rascunho" })).toHaveAttribute("href", "/painel/meus-treinos/w2");
    expect(screen.getByRole("link", { name: "+ Montar meu treino" })).toHaveAttribute("href", "/painel/meus-treinos/novo");
    expect(screen.getByRole("link", { name: /7 treinos no mês/ })).toHaveAttribute("href", "/painel/minha-evolucao");
    expect(screen.getByRole("link", { name: /2 metas em andamento/ })).toHaveAttribute("href", "/painel/minha-evolucao?aba=metas");
  });

  it("sem dia sugerido mostra a sugestão do rodízio", () => {
    renderHome({ today: { ...workout, reason: "rodizio" } });
    expect(screen.getByText("Sugestão de hoje")).toBeInTheDocument();
    expect(screen.getByText(/o que você fez há mais tempo/)).toBeInTheDocument();
  });

  it("treino em andamento continua", () => {
    renderHome({ inProgress: { workoutName: "Superiores A", done: 2, total: 5, minutesAgo: 9 } });
    expect(screen.getByRole("link", { name: "Continuar treino" })).toHaveAttribute("href", "/painel/meus-treinos/sessao");
  });

  it("primeiro acesso sem treinos: criar o primeiro", () => {
    renderHome({ today: null, workouts: [] });
    expect(screen.getByRole("link", { name: /Criar meu primeiro treino/ })).toHaveAttribute("href", "/painel/meus-treinos/novo");
  });
});
