import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ToastProvider } from "@/shared/ui";

const requireIndividual = vi.fn();
const ensureStudentForIndividual = vi.fn();
const listAssessmentsForStudent = vi.fn();
const listGoalsForStudent = vi.fn();
const getTrainingOverviewForStudent = vi.fn();
const listPersonalRecordsForStudent = vi.fn();
const listSessionHistoryForStudent = vi.fn();
const redirect = vi.fn((_url: string) => {
  throw new Error("NEXT_REDIRECT");
});

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requireIndividual: (...args: unknown[]) => requireIndividual(...args) };
});
vi.mock("@/modules/tenancy/ensureStudentForIndividual", () => ({ ensureStudentForIndividual: (...args: unknown[]) => ensureStudentForIndividual(...args) }));
vi.mock("@/modules/evolution/assessments", () => ({ listAssessmentsForStudent: (...args: unknown[]) => listAssessmentsForStudent(...args) }));
vi.mock("@/modules/evolution/goals", () => ({ listGoalsForStudent: (...args: unknown[]) => listGoalsForStudent(...args) }));
vi.mock("@/modules/execution/history", () => ({
  getTrainingOverviewForStudent: (...args: unknown[]) => getTrainingOverviewForStudent(...args),
  listPersonalRecordsForStudent: (...args: unknown[]) => listPersonalRecordsForStudent(...args),
  listSessionHistoryForStudent: (...args: unknown[]) => listSessionHistoryForStudent(...args),
}));
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirect(url), useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/modules/identity/auth-client", () => ({ signOut: vi.fn() }));

function setup() {
  requireIndividual.mockResolvedValue({ userId: "u1", role: "INDIVIDUAL", tenantId: "t1" });
  ensureStudentForIndividual.mockResolvedValue({ id: "self" });
  getTrainingOverviewForStudent.mockResolvedValue({ thisWeek: 2, thisMonth: 7, streakWeeks: 3 });
  listPersonalRecordsForStudent.mockResolvedValue([{ exerciseName: "Remada", loadUsed: "30 kg", loadValue: 30, repsCompleted: 10, achievedAt: new Date("2026-10-01T12:00:00Z") }]);
  listSessionHistoryForStudent.mockResolvedValue([{ id: "s1", workoutName: "Superiores A", status: "ABANDONADA", startedAt: new Date("2026-10-02T12:00:00Z"), endedAt: null, resultsCount: 1, perceivedEffort: null }, { id: "s2", workoutName: "Inferiores B", status: "CONCLUIDA", startedAt: new Date("2026-10-01T12:00:00Z"), endedAt: null, resultsCount: 3, perceivedEffort: 4 }]);
  listAssessmentsForStudent.mockResolvedValue([{ id: "a1", recordedAt: new Date("2026-10-01T12:00:00Z"), weightGrams: 70500, bodyFatTenthPercent: 180, notes: "Pós-férias", measurements: [] }]);
  listGoalsForStudent.mockResolvedValue([
    { id: "g1", description: "Correr 5 km", targetDate: null, status: "EM_ANDAMENTO", completedAt: null },
    { id: "g2", description: "Supino 50 kg", targetDate: null, status: "CONCLUIDA", completedAt: new Date("2026-09-01T12:00:00Z") },
  ]);
}

async function renderPage(aba?: string) {
  const { default: Page } = await import("./page");
  render(<ToastProvider>{await Page({ searchParams: Promise.resolve(aba ? { aba } : {}) })}</ToastProvider>);
}

describe("Minha evolução do FitOS Livre (FIT-159)", () => {
  afterEach(() => vi.resetAllMocks());

  it("Treinos: semana, mês, semanas seguidas, recordes e histórico concluído ou abandonado", async () => {
    setup();
    await renderPage();
    expect(screen.getByText("semanas seguidas")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("30 kg × 10")).toBeInTheDocument();
    expect(screen.getByText("Abandonado")).toBeInTheDocument();
    expect(screen.getByText(/esforço puxado/)).toBeInTheDocument();
    expect(getTrainingOverviewForStudent).toHaveBeenCalledWith({ tenantId: "t1", studentId: "self" });
  });

  it("Corpo: registrar já com os últimos valores e excluir com confirmação", async () => {
    setup();
    await renderPage("corpo");
    expect(screen.getByRole("link", { name: /Pesar hoje/ })).toHaveAttribute("href", "/painel/pesar");
    fireEvent.click(screen.getByRole("button", { name: /Excluir registro de/ }));
    expect(screen.getByRole("dialog", { name: "Excluir este registro?" })).toBeInTheDocument();
  });

  it("Metas: nova meta com prazo em chips, Concluí e Abandonar, e encerradas", async () => {
    setup();
    await renderPage("metas");
    expect(screen.getByRole("button", { name: "Concluí" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abandonar Correr 5 km" })).toBeInTheDocument();
    expect(screen.getByText("Concluída")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Nova meta/ })).toHaveAttribute("href", "/painel/meta");
  });
});
