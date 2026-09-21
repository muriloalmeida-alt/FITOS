import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { StudentTodaySchedule } from "@/modules/workouts/workouts";
import { AlunoHome } from "./AlunoHome";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/modules/identity/auth-client", () => ({
  signOut: vi.fn(),
}));

function renderHome(schedule: StudentTodaySchedule, hasInProgressSession = false) {
  render(
    <AlunoHome
      displayName="Pedro"
      tenantName="Espaço de Joana"
      personalName="Joana"
      schedule={schedule}
      hasInProgressSession={hasInProgressSession}
    />
  );
}

describe("AlunoHome (FIT-040 — treino de hoje)", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("estado SEM_PLANO", () => {
    renderHome({ state: "SEM_PLANO" });

    expect(
      screen.getByText("Você ainda não tem um programa de treino atribuído. Fale com seu personal.")
    ).toBeInTheDocument();
  });

  it("estado PLANO_ENCERRADO", () => {
    renderHome({ state: "PLANO_ENCERRADO", planName: "Programa A" });

    expect(screen.getByText(/Programa A/)).toBeInTheDocument();
    expect(screen.getByText(/foi encerrado/)).toBeInTheDocument();
  });

  it("estado DESCANSO", () => {
    renderHome({ state: "DESCANSO" });

    expect(screen.getByText("Hoje é dia de descanso. Nenhum treino previsto para hoje.")).toBeInTheDocument();
  });

  it("estado TREINO_HOJE: exercícios, parâmetros e instruções legíveis", () => {
    renderHome({
      state: "TREINO_HOJE",
      workout: {
        id: "w1",
        name: "Treino A",
        workoutExercises: [
          {
            id: "i1",
            sets: 3,
            reps: 10,
            durationSeconds: null,
            load: "20kg",
            restSeconds: 60,
            notes: "Foco na execução",
            exercise: { name: "Supino", muscle: "Peito", instructions: "Manter os cotovelos a 45 graus." },
          },
        ],
      },
    } as unknown as StudentTodaySchedule);

    expect(screen.getByText("Treino A")).toBeInTheDocument();
    expect(screen.getByText("Supino")).toBeInTheDocument();
    expect(screen.getByText("Peito")).toBeInTheDocument();
    expect(screen.getByText(/3 séries.*10 repetições.*carga: 20kg.*descanso: 60s/)).toBeInTheDocument();
    expect(screen.getByText("Foco na execução")).toBeInTheDocument();
    expect(screen.getByText("Manter os cotovelos a 45 graus.")).toBeInTheDocument();
  });

  it("estado TREINO_HOJE sem exercícios: estado vazio honesto", () => {
    renderHome({
      state: "TREINO_HOJE",
      workout: { id: "w1", name: "Treino A", workoutExercises: [] },
    } as unknown as StudentTodaySchedule);

    expect(screen.getByText("Este treino ainda não tem exercícios.")).toBeInTheDocument();
  });

  it("mostra 'Começar treino' quando há treino previsto para hoje e nenhuma sessão em andamento", () => {
    renderHome({ state: "TREINO_HOJE", workout: { id: "w1", name: "Treino A", workoutExercises: [] } } as unknown as StudentTodaySchedule, false);

    expect(screen.getByRole("link", { name: "Começar treino" })).toBeInTheDocument();
  });

  it("mostra 'Continuar treino em andamento' quando há sessão em andamento, mesmo em dia de descanso", () => {
    renderHome({ state: "DESCANSO" }, true);

    expect(screen.getByRole("link", { name: "Continuar treino em andamento" })).toBeInTheDocument();
  });

  it("não mostra nenhum link para sessão sem treino de hoje e sem sessão em andamento", () => {
    renderHome({ state: "SEM_PLANO" }, false);

    expect(screen.queryByRole("link", { name: "Começar treino" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Continuar treino em andamento" })).not.toBeInTheDocument();
  });
});
