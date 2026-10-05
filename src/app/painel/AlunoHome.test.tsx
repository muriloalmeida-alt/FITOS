import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { StudentHome } from "@/modules/students/studentHome";
import { AlunoHome } from "./AlunoHome";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/modules/identity/auth-client", () => ({ signOut: vi.fn() }));

const base: StudentHome = {
  hero: { kind: "today", workoutName: "Treino A · Peito", exercises: 6, estimatedMinutes: 45 },
  program: { name: "Hipertrofia", week: 3, weeks: 8 },
  week: { planned: ["SEGUNDA", "QUARTA", "SEXTA"], done: [true, false, false, false, false, false, false], doneCount: 1, target: 3 },
  upcoming: [{ dayLabel: "Amanhã", dayShort: "Ter", workoutName: "Treino B" }],
  lastAssessment: { dateIso: "2026-09-20T12:00:00.000Z", weightKg: 72.4, bodyFatPercent: 18.5 },
};

function renderHome(home: Partial<StudentHome> = {}) {
  render(<AlunoHome displayName="Pedro Lima" personalName="Joana" greeting="Bom dia" dateLabel="Domingo, 4 de outubro" home={{ ...base, ...home }} todayIso="2026-10-05T12:00:00.000Z" />);
}

describe("AlunoHome (FIT-151)", () => {
  it("treino do dia começa com um toque, com semana, próximos e última avaliação", () => {
    renderHome();
    expect(screen.getByRole("heading", { level: 1, name: "Bom dia, Pedro." })).toBeInTheDocument();
    expect(screen.getByText("6 exercícios · cerca de 45 min")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Começar treino" })).toHaveAttribute("href", "/painel/treino/sessao");
    expect(screen.getByText("1 de 3 treinos")).toBeInTheDocument();
    expect(screen.getByText("Hipertrofia · semana 3 de 8")).toBeInTheDocument();
    expect(screen.getByLabelText("Segunda (hoje): treino feito")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Treino B/ })).toHaveAttribute("href", "/painel/treino");
    expect(screen.getByRole("link", { name: /72,4 kg · 18,5% gordura/ })).toHaveAttribute("href", "/painel/progresso");
  });

  it("em andamento continua com progresso e tempo", () => {
    renderHome({ hero: { kind: "progress", workoutName: "Treino A", done: 2, total: 6, minutesAgo: 14 } });
    expect(screen.getByText("2 de 6 exercícios · começou há 14 min")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continuar treino" })).toHaveAttribute("href", "/painel/treino/sessao");
  });

  it("descanso mostra o próximo treino e leva ao programa", () => {
    renderHome({ hero: { kind: "rest", next: { dayLabel: "Amanhã", dayShort: "Ter", workoutName: "Treino B" } } });
    expect(screen.getByText("Próximo: Treino B · amanhã")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver meu programa" })).toHaveAttribute("href", "/painel/treino");
    expect(screen.queryByRole("link", { name: "Começar treino" })).not.toBeInTheDocument();
  });

  it("sem programa diz que o personal já foi avisado, sem semana nem avaliação inventada", () => {
    renderHome({ hero: { kind: "noPlan", endedPlanName: null }, program: null, upcoming: [], lastAssessment: null });
    expect(screen.getByText(/Joana já foi avisado/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Sua semana" })).not.toBeInTheDocument();
    expect(screen.getByText("Nenhuma avaliação ainda")).toBeInTheDocument();
  });
});
