import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { StudentHome } from "@/modules/students/studentHome";
import { AlunoHome } from "./AlunoHome";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/modules/identity/auth-client", () => ({ signOut: vi.fn() }));

const base: StudentHome = {
  hero: { kind: "today", workoutName: "Treino A · Peito", exercises: 6, estimatedMinutes: 45 },
  program: { name: "Hipertrofia", week: 3, weeks: 8 },
  week: { planned: ["SEGUNDA", "QUARTA", "SEXTA"], done: [true, false, false, false, false, false, false], doneCount: 1, target: 3 },
  upcoming: [],
  lastAssessment: { dateIso: "2026-10-01T12:00:00.000Z", weightKg: 72.4, bodyFatPercent: 18.5 },
  goal: null,
};

// Quarta, 7/10/2026, 15h em Brasília.
const todayIso = "2026-10-07T18:00:00.000Z";

function renderHome(props: Partial<Parameters<typeof AlunoHome>[0]> = {}) {
  render(<AlunoHome displayName="Pedro Lima" personalName="Joana Souza" dateLabel="Quarta, 7 de outubro" home={base} todayIso={todayIso} {...props} />);
}

describe("AlunoHome: painel (proposta 9)", () => {
  it("data, saudação e mensagem; semana com datas, feitos e hoje; evolução com meta pelos dias do programa", () => {
    renderHome({ performed: ["2026-10-05T12:00:00.000Z", "2026-10-01T12:00:00.000Z"] });
    expect(screen.getByRole("heading", { level: 1, name: "Olá, Pedro!" })).toBeInTheDocument();
    expect(screen.getByText("Seu próximo treino começa aqui.")).toBeInTheDocument();
    expect(screen.getByText("5 - 11 out.")).toBeInTheDocument();
    expect(screen.getByLabelText("Segunda, dia 5: treino realizado")).toBeInTheDocument();
    expect(screen.getByLabelText("Quarta, dia 7 (hoje): treino previsto")).toBeInTheDocument();
    expect(screen.getByText(/Hoje: Treino A · Peito/)).toBeInTheDocument();
    // Semana: 1 de 3 (seg, qua, sex); mês: 2 de 13 (outubro).
    expect(screen.getByText("1 de 3 treinos")).toBeInTheDocument();
    expect(screen.getByText("33% da meta")).toBeInTheDocument();
    expect(screen.getByText("2 de 13 treinos")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver minha evolução/ })).toHaveAttribute("href", "/painel/progresso");
  });

  it("Iniciar treino abre a escolha sem iniciar nada; programado leva ao treino do dia; realizado só com a flag", async () => {
    renderHome({ retroEnabled: true });
    await userEvent.click(screen.getByRole("button", { name: "Iniciar treino" }));
    const dialog = screen.getByRole("dialog", { name: "Como deseja treinar?" });
    expect(router.push).not.toHaveBeenCalled();
    const options = within(dialog).getAllByRole("button").map((button) => button.textContent);
    expect(options[0]).toMatch(/Treino programado/);
    expect(options[1]).toMatch(/Treino realizado/);
    // Aluno com personal não tem treino avulso.
    expect(within(dialog).queryByText("Treino avulso")).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: /Treino programado/ }));
    expect(router.push).toHaveBeenCalledWith("/painel/treino/sessao");
  });

  it("em andamento: Continuar treino retoma a sessão; sem meta configurada mostra a contagem", () => {
    renderHome({ home: { ...base, hero: { kind: "progress", workoutName: "Treino A", done: 2, total: 6, minutesAgo: 14 }, week: { ...base.week, planned: [], target: null } } });
    expect(screen.getByRole("link", { name: "Continuar treino" })).toHaveAttribute("href", "/painel/treino/sessao");
    expect(screen.getAllByText("Meta não definida")).toHaveLength(2);
  });

  it("o + abre direto a escolha (startOpen)", () => {
    renderHome({ startOpen: true });
    expect(screen.getByRole("dialog", { name: "Como deseja treinar?" })).toBeInTheDocument();
  });
});
