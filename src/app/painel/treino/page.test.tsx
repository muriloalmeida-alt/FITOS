import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const requireStudent = vi.fn();
const getActivePlanAssignmentForStudent = vi.fn();
const listEndedPlanAssignmentsForStudent = vi.fn();
const redirect = vi.fn((_url: string) => {
  throw new Error("NEXT_REDIRECT");
});

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
    "@/modules/tenancy/authContext"
  );
  return { ...actual, requireStudent: (...args: unknown[]) => requireStudent(...args) };
});

vi.mock("@/modules/workouts/workouts", async () => {
  const actual = await vi.importActual<typeof import("@/modules/workouts/workouts")>("@/modules/workouts/workouts");
  return {
    ...actual,
    getActivePlanAssignmentForStudent: (...args: unknown[]) => getActivePlanAssignmentForStudent(...args),
    listEndedPlanAssignmentsForStudent: (...args: unknown[]) => listEndedPlanAssignmentsForStudent(...args),
  };
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/modules/identity/auth-client", () => ({
  signOut: vi.fn(),
}));

describe("TreinoAlunoPage (FIT-033)", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("redireciona para /entrar quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
      "@/modules/tenancy/authContext"
    );
    requireStudent.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));
    const { default: TreinoAlunoPage } = await import("./page");

    await expect(TreinoAlunoPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/entrar");
  });

  it("redireciona para /painel quando o usuário não é aluno com vínculo ativo", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
      "@/modules/tenancy/authContext"
    );
    requireStudent.mockRejectedValue(new AuthError("FORBIDDEN", "Acesso restrito a aluno com vínculo ativo."));
    const { default: TreinoAlunoPage } = await import("./page");

    await expect(TreinoAlunoPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/painel");
  });

  it("estado sem plano: nenhuma atribuição ativa e nenhum histórico", async () => {
    requireStudent.mockResolvedValue({ userId: "u1", role: "ALUNO", tenantId: "t1", studentId: "s1" });
    getActivePlanAssignmentForStudent.mockResolvedValue(null);
    listEndedPlanAssignmentsForStudent.mockResolvedValue([]);
    const { default: TreinoAlunoPage } = await import("./page");

    render(await TreinoAlunoPage());

    expect(
      screen.getByText("Você ainda não tem um programa de treino atribuído. Fale com seu personal.")
    ).toBeInTheDocument();
  });

  it("estado plano encerrado: nenhuma atribuição ativa, mas há histórico", async () => {
    requireStudent.mockResolvedValue({ userId: "u1", role: "ALUNO", tenantId: "t1", studentId: "s1" });
    getActivePlanAssignmentForStudent.mockResolvedValue(null);
    listEndedPlanAssignmentsForStudent.mockResolvedValue([
      { id: "a0", trainingPlan: { name: "Programa Antigo" } },
    ]);
    const { default: TreinoAlunoPage } = await import("./page");

    render(await TreinoAlunoPage());

    expect(screen.getByText(/Programa Antigo/)).toBeInTheDocument();
    expect(screen.getByText(/foi encerrado/)).toBeInTheDocument();
  });

  it("estado plano ativo: mostra o programa, os modelos e os exercícios, somente leitura", async () => {
    requireStudent.mockResolvedValue({ userId: "u1", role: "ALUNO", tenantId: "t1", studentId: "s1" });
    getActivePlanAssignmentForStudent.mockResolvedValue({
      id: "a1",
      trainingPlan: {
        name: "Programa A",
        durationWeeks: 4,
        workouts: [
          {
            id: "w1",
            name: "Treino A",
            suggestedDays: ["SEGUNDA", "QUARTA"],
            workoutExercises: [
              {
                id: "i1",
                sets: 3,
                reps: 10,
                durationSeconds: null,
                load: "20kg",
                restSeconds: 60,
                notes: "Foco na execução",
                exercise: { name: "Supino", muscle: "Peito" },
              },
            ],
          },
        ],
      },
    });
    const { default: TreinoAlunoPage } = await import("./page");

    render(await TreinoAlunoPage());

    expect(screen.getByText("Programa A")).toBeInTheDocument();
    expect(screen.getByText("Vigência sugerida: 4 semanas")).toBeInTheDocument();
    expect(screen.getByText("Treino A")).toBeInTheDocument();
    expect(screen.getByText("SEGUNDA, QUARTA")).toBeInTheDocument();
    expect(screen.getByText("Supino")).toBeInTheDocument();
    expect(screen.getByText("Peito")).toBeInTheDocument();
    expect(screen.getByText(/3 séries.*10 repetições.*carga: 20kg.*descanso: 60s/)).toBeInTheDocument();
    expect(screen.getByText("Foco na execução")).toBeInTheDocument();
  });
});
