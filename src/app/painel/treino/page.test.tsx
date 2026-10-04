import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { WEEKDAYS, mondayFirstIndex } from "@/shared/lib/weekdays";

const requireStudent = vi.fn();
const getActivePlanAssignmentForStudent = vi.fn();
const listEndedPlanAssignmentsForStudent = vi.fn();
const getWeeklyRhythmForStudent = vi.fn();
const findStudent = vi.fn();
const redirect = vi.fn((_url: string) => {
  throw new Error("NEXT_REDIRECT");
});

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requireStudent: (...args: unknown[]) => requireStudent(...args) };
});
vi.mock("@/modules/workouts/workouts", () => ({
  getActivePlanAssignmentForStudent: (...args: unknown[]) => getActivePlanAssignmentForStudent(...args),
  listEndedPlanAssignmentsForStudent: (...args: unknown[]) => listEndedPlanAssignmentsForStudent(...args),
  getWeeklyRhythmForStudent: (...args: unknown[]) => getWeeklyRhythmForStudent(...args),
}));
vi.mock("@/shared/db/prisma", () => ({ prisma: { student: { findUniqueOrThrow: (...args: unknown[]) => findStudent(...args) } } }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirect(url), useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/modules/identity/auth-client", () => ({ signOut: vi.fn() }));

const todayKey = WEEKDAYS[mondayFirstIndex(new Date())]!.key;
const otherDay = WEEKDAYS[(mondayFirstIndex(new Date()) + 2) % 7]!.key;
const item = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  sets: 3,
  reps: 12,
  durationSeconds: null,
  load: "20 kg",
  restSeconds: 60,
  notes: null,
  exercise: { name, muscle: "Peito", instructions: null, imageUrl: null, imageAlt: null },
  ...extra,
});

function setup(active: unknown) {
  requireStudent.mockResolvedValue({ userId: "u1", role: "ALUNO", tenantId: "t1", studentId: "s1" });
  findStudent.mockResolvedValue({ id: "s1", tenant: { owner: { name: "Joana Lima" } } });
  getWeeklyRhythmForStudent.mockResolvedValue({ completedDays: 0, targetDays: 2, dayFlags: [false, false, false, false, false, false, false] });
  getActivePlanAssignmentForStudent.mockResolvedValue(active);
  listEndedPlanAssignmentsForStudent.mockResolvedValue([]);
}

describe("TreinoAlunoPage (FIT-152)", () => {
  afterEach(() => vi.resetAllMocks());

  it("sem sessão vai para /entrar; sem vínculo volta ao Início", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    const { default: TreinoAlunoPage } = await import("./page");
    requireStudent.mockRejectedValueOnce(new AuthError("UNAUTHENTICATED", "x"));
    await expect(TreinoAlunoPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenLastCalledWith("/entrar");
    requireStudent.mockRejectedValueOnce(new AuthError("FORBIDDEN", "x"));
    await expect(TreinoAlunoPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenLastCalledWith("/painel");
  });

  it("mostra quem prescreveu, a semana do programa e abre o treino de hoje", async () => {
    setup({
      assignedAt: new Date(Date.now() - 15 * 86_400_000),
      trainingPlan: {
        name: "Hipertrofia",
        durationWeeks: 8,
        workouts: [
          { id: "w1", name: "Treino A", status: "ATIVO", suggestedDays: [otherDay], workoutExercises: [item("i1", "Agachamento")] },
          { id: "w2", name: "Treino B", status: "ATIVO", suggestedDays: [todayKey], workoutExercises: [item("i2", "Supino reto", { notes: "Desça devagar" })] },
          { id: "w3", name: "Antigo", status: "ARQUIVADO", suggestedDays: [], workoutExercises: [] },
        ],
      },
    });
    const { default: TreinoAlunoPage } = await import("./page");
    render(await TreinoAlunoPage());

    expect(screen.getByRole("heading", { level: 1, name: "Hipertrofia" })).toBeInTheDocument();
    expect(screen.getByText("Prescrito por Joana Lima")).toBeInTheDocument();
    expect(screen.getByText("Semana 3 de 8")).toBeInTheDocument();
    expect(screen.queryByText("Antigo")).not.toBeInTheDocument();

    expect(screen.getByRole("button", { name: /Treino B Hoje/ })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("3 × 12 · 20 kg · 60 s de descanso")).toBeInTheDocument();
    expect(screen.getByText("“Desça devagar”")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Começar este treino" })).toHaveAttribute("href", "/painel/treino/sessao?treino=w2");

    fireEvent.click(screen.getByRole("button", { name: /Treino A/ }));
    expect(screen.getByText("Agachamento")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Começar este treino" })).toHaveAttribute("href", "/painel/treino/sessao?treino=w1");
  });

  it("sem programa diz que o personal já foi avisado", async () => {
    setup(null);
    const { default: TreinoAlunoPage } = await import("./page");
    render(await TreinoAlunoPage());
    expect(screen.getByText(/Joana Lima já foi avisado/)).toBeInTheDocument();
  });
});
