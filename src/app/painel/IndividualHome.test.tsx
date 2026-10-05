import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { IndividualHome as Data } from "@/modules/workouts/individualHome";
import { IndividualHome } from "./IndividualHome";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/modules/identity/auth-client", () => ({ signOut: vi.fn() }));

const workout = { id: "w1", name: "Superiores A", exercises: 5, estimatedMinutes: 40, days: ["SEGUNDA", "QUINTA"] };
const base: Data = {
  today: { ...workout, reason: "dia" },
  missed: null,
  inProgress: null,
  workouts: [workout, { id: "w2", name: "Rascunho", exercises: 0, estimatedMinutes: 5, days: [] }],
  week: { done: [true, false, false, false, false, false, false], doneCount: 1, target: 4 },
  monthSessions: 7,
  activeGoals: 2,
  progressions: [],
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

  it("sugere subir a carga e grava no item ao aceitar (EPIC-30)", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response("{}", { status: 200 }));
    renderHome({ progressions: [{ workoutId: "w1", itemId: "i1", workoutName: "Superiores A", exerciseName: "Puxada alta", fromKg: 40, toKg: 42.5, reps: 12 }] });
    expect(screen.getByText("Subir puxada alta para 42,5 kg?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Subir" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/meus-treinos/w1/itens/i1", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ load: "42,5 kg" }) }));
    fetchMock.mockRestore();
  });

  it("Manter esconde a sugestão", async () => {
    renderHome({ progressions: [{ workoutId: "w1", itemId: "i9", workoutName: "Superiores A", exerciseName: "Remada", fromKg: 30, toKg: 32.5, reps: 10 }] });
    await userEvent.click(screen.getByRole("button", { name: "Manter" }));
    expect(screen.queryByText(/Subir remada/)).not.toBeInTheDocument();
  });

  it("trocar o dia: o treino que ficou para trás aparece como sugestão (EPIC-38)", () => {
    renderHome({ missed: { id: "w3", name: "Inferiores B", exercises: 5, estimatedMinutes: 40, days: ["QUARTA"], missedDay: "ontem" } });
    const card = screen.getByRole("link", { name: /Trocar: Inferiores B hoje/ });
    expect(card).toHaveAttribute("href", "/painel/meus-treinos/sessao?treino=w3");
    expect(card).toHaveTextContent("deixa Superiores A para amanhã");
  });

  it("dia livre com treino atrasado: ele vira o de hoje (EPIC-38)", () => {
    renderHome({ today: { id: "w3", name: "Inferiores B", exercises: 5, estimatedMinutes: 40, days: ["QUARTA"], reason: "faltou", missedDay: "quarta" } });
    expect(screen.getByText("Ficou de quarta")).toBeInTheDocument();
    expect(screen.getByText(/hoje é dia livre, dá para recuperar/)).toBeInTheDocument();
  });
});
