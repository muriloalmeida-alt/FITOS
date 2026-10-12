import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { IndividualHome as Data } from "@/modules/workouts/individualHome";
import { IndividualHome } from "./IndividualHome";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/modules/identity/auth-client", () => ({ signOut: vi.fn() }));

const workout = { id: "w1", name: "Superiores A", exercises: 5, estimatedMinutes: 40, days: ["SEGUNDA", "QUINTA"] };
const base: Data = {
  today: { ...workout, reason: "dia" },
  missed: null,
  inProgress: null,
  workouts: [workout],
  week: { done: [true, false, false, false, false, false, false], doneCount: 1, target: 4 },
  monthSessions: 7,
  activeGoals: 2,
  progressions: [],
};

function renderHome(props: Partial<Parameters<typeof IndividualHome>[0]> = {}) {
  render(<IndividualHome name="Rafa Costa" dateLabel="Segunda, 5 de outubro" home={base} todayIso="2026-10-05T15:00:00.000Z" {...props} />);
}

describe("IndividualHome: painel (proposta 9)", () => {
  it("Iniciar treino: programado, avulso e realizado, nesta ordem", async () => {
    renderHome({ retroEnabled: true, preferredDays: ["SEGUNDA", "QUARTA", "SEXTA"] });
    expect(screen.getByRole("heading", { level: 1, name: "Olá, Rafa!" })).toBeInTheDocument();
    expect(screen.getByText(/Hoje: Superiores A/)).toBeInTheDocument();
    expect(screen.getByText("0 de 3 treinos")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Iniciar treino" }));
    const dialog = screen.getByRole("dialog", { name: "Como deseja treinar?" });
    expect(within(dialog).getAllByRole("button").map((button) => button.querySelector("strong")?.textContent)).toEqual(["Treino programado", "Treino avulso", "Treino realizado"]);
    await userEvent.click(within(dialog).getByRole("button", { name: /Treino avulso/ }));
    // Uma modal de cada vez: a escolha fecha e abre o foco do avulso.
    expect(screen.queryByRole("dialog", { name: "Como deseja treinar?" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "O que você quer treinar hoje?" })).toBeInTheDocument();
  });

  it("realizado leva ao registro; programado ao treino do dia", async () => {
    renderHome({ retroEnabled: true });
    await userEvent.click(screen.getByRole("button", { name: "Iniciar treino" }));
    await userEvent.click(screen.getByRole("button", { name: /Treino realizado/ }));
    expect(router.push).toHaveBeenCalledWith("/painel/treinos-realizados/registrar");
    await userEvent.click(screen.getByRole("button", { name: "Iniciar treino" }));
    await userEvent.click(screen.getByRole("button", { name: /Treino programado/ }));
    expect(router.push).toHaveBeenCalledWith("/painel/meus-treinos/sessao?treino=w1");
  });

  it("sem treinos: programado oferece a biblioteca; sem a flag, sem treino realizado", async () => {
    renderHome({ home: { ...base, today: null, workouts: [] } });
    await userEvent.click(screen.getByRole("button", { name: "Iniciar treino" }));
    expect(screen.getByText("Sem programa ainda: escolha um pronto")).toBeInTheDocument();
    expect(screen.queryByText("Treino realizado")).not.toBeInTheDocument();
  });
});
