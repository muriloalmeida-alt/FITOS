import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ToastProvider } from "@/shared/ui";

const requireStudent = vi.fn();
const getInProgressSessionForStudent = vi.fn();
const getLastPerformanceForExercises = vi.fn();
const getActivePlanAssignmentForStudent = vi.fn();
const getTodayScheduleForStudent = vi.fn();
const findStudent = vi.fn();
const redirect = vi.fn((_url: string) => {
  throw new Error("NEXT_REDIRECT");
});

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requireStudent: (...args: unknown[]) => requireStudent(...args) };
});
vi.mock("@/modules/execution/sessions", () => ({ getInProgressSessionForStudent: (...args: unknown[]) => getInProgressSessionForStudent(...args) }));
vi.mock("@/modules/execution/sets", () => ({ getLastPerformanceForExercises: (...args: unknown[]) => getLastPerformanceForExercises(...args) }));
vi.mock("@/modules/workouts/workouts", () => ({
  getActivePlanAssignmentForStudent: (...args: unknown[]) => getActivePlanAssignmentForStudent(...args),
  getTodayScheduleForStudent: (...args: unknown[]) => getTodayScheduleForStudent(...args),
}));
vi.mock("@/shared/db/prisma", () => ({ prisma: { student: { findUniqueOrThrow: (...args: unknown[]) => findStudent(...args) } } }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirect(url), useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/modules/identity/auth-client", () => ({ signOut: vi.fn() }));

const exercise = (name: string) => ({ name, muscle: null, instructions: "Pés firmes. Desça controlando.", imageUrl: null, imageAlt: null });
const items = [
  { id: "we1", exerciseId: "e1", sets: 3, reps: 10, durationSeconds: null, load: "40 kg", restSeconds: 90, notes: "Desça até 90°", exercise: exercise("Agachamento livre") },
  { id: "we2", exerciseId: "e2", sets: 2, reps: null, durationSeconds: 30, load: null, restSeconds: 30, notes: null, exercise: exercise("Prancha") },
];

function asStudent() {
  requireStudent.mockResolvedValue({ userId: "u1", role: "ALUNO", tenantId: "t1", studentId: "s1" });
  findStudent.mockResolvedValue({ id: "s1", tenant: { owner: { name: "Joana Lima" } } });
  getLastPerformanceForExercises.mockResolvedValue(new Map([["e1", { last: { loadKg: 37.5, reps: 10, durationSeconds: null }, bestLoadKg: 40 }]]));
}

async function renderPage(searchParams: Record<string, string> = {}) {
  const { default: SessaoPage } = await import("./page");
  render(<ToastProvider>{await SessaoPage({ searchParams: Promise.resolve(searchParams) })}</ToastProvider>);
}

describe("SessaoPage (FIT-153)", () => {
  afterEach(() => vi.resetAllMocks());

  it("sem vínculo volta ao Início", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requireStudent.mockRejectedValue(new AuthError("FORBIDDEN", "x"));
    const { default: SessaoPage } = await import("./page");
    await expect(SessaoPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/painel");
  });

  it("retoma a sessão em andamento com as séries já feitas e a última vez", async () => {
    asStudent();
    getInProgressSessionForStudent.mockResolvedValue({
      id: "sess1",
      workoutId: "w1",
      startedAt: new Date(Date.now() - 10 * 60_000),
      workout: { name: "Treino A", workoutExercises: items },
      setResults: [{ workoutExerciseId: "we1", setNumber: 1, reps: 10, durationSeconds: null, loadGrams: 40000 }],
    });
    await renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "Agachamento livre" })).toBeInTheDocument();
    expect(screen.getByLabelText("1 de 3 séries feitas")).toBeInTheDocument();
    expect(screen.getByText("Joana: Desça até 90°")).toBeInTheDocument();
    expect(screen.getByText("Última vez: 37,5 kg × 10")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fiz 10 × 40 kg" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Música/ })).toBeInTheDocument();
    expect(getLastPerformanceForExercises).toHaveBeenCalledWith({ tenantId: "t1", studentId: "s1", exerciseIds: ["e1", "e2"], excludeSessionId: "sess1" });
  });

  it("treino escolhido no programa abre a preparação", async () => {
    asStudent();
    getInProgressSessionForStudent.mockResolvedValue(null);
    getActivePlanAssignmentForStudent.mockResolvedValue({ trainingPlan: { workouts: [{ id: "w2", name: "Treino B", status: "ATIVO", workoutExercises: items }] } });
    await renderPage({ treino: "w2" });

    expect(screen.getByRole("heading", { level: 1, name: "Treino B" })).toBeInTheDocument();
    expect(screen.getByText("2 exercícios · 5 séries · cerca de 10 min")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: /Voz e bipes/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("switch", { name: /Tela sempre ligada/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Começar treino" })).toBeInTheDocument();
    expect(getTodayScheduleForStudent).not.toHaveBeenCalled();
  });

  it("dia de descanso sem treino escolhido leva ao programa", async () => {
    asStudent();
    getInProgressSessionForStudent.mockResolvedValue(null);
    getActivePlanAssignmentForStudent.mockResolvedValue({ trainingPlan: { workouts: [] } });
    getTodayScheduleForStudent.mockResolvedValue({ state: "DESCANSO" });
    await renderPage();
    expect(screen.getByText(/Hoje é descanso/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver meu programa" })).toHaveAttribute("href", "/painel/treino");
  });
});
