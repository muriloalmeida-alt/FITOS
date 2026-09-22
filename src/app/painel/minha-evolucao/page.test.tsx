import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const requireIndividual = vi.fn();
const ensureStudentForIndividual = vi.fn();
const listAssessmentsForStudent = vi.fn();
const listGoalsForStudent = vi.fn();
const getFrequencySummaryForStudent = vi.fn();
const listPersonalRecordsForStudent = vi.fn();
const listSessionHistoryForStudent = vi.fn();
const redirect = vi.fn((_url: string) => {
  throw new Error("NEXT_REDIRECT");
});

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requireIndividual: (...args: unknown[]) => requireIndividual(...args) };
});

vi.mock("@/modules/tenancy/ensureStudentForIndividual", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/ensureStudentForIndividual")>(
    "@/modules/tenancy/ensureStudentForIndividual"
  );
  return { ...actual, ensureStudentForIndividual: (...args: unknown[]) => ensureStudentForIndividual(...args) };
});

vi.mock("@/modules/evolution/assessments", async () => {
  const actual = await vi.importActual<typeof import("@/modules/evolution/assessments")>("@/modules/evolution/assessments");
  return { ...actual, listAssessmentsForStudent: (...args: unknown[]) => listAssessmentsForStudent(...args) };
});

vi.mock("@/modules/evolution/goals", async () => {
  const actual = await vi.importActual<typeof import("@/modules/evolution/goals")>("@/modules/evolution/goals");
  return { ...actual, listGoalsForStudent: (...args: unknown[]) => listGoalsForStudent(...args) };
});

vi.mock("@/modules/execution/history", async () => {
  const actual = await vi.importActual<typeof import("@/modules/execution/history")>("@/modules/execution/history");
  return {
    ...actual,
    getFrequencySummaryForStudent: (...args: unknown[]) => getFrequencySummaryForStudent(...args),
    listPersonalRecordsForStudent: (...args: unknown[]) => listPersonalRecordsForStudent(...args),
    listSessionHistoryForStudent: (...args: unknown[]) => listSessionHistoryForStudent(...args),
  };
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/modules/identity/auth-client", () => ({
  signOut: vi.fn(),
}));

function mockEmptyState() {
  requireIndividual.mockResolvedValue({ userId: "u1", role: "INDIVIDUAL", tenantId: "t1" });
  ensureStudentForIndividual.mockResolvedValue({ id: "student-auto-referencia" });
  listAssessmentsForStudent.mockResolvedValue([]);
  listGoalsForStudent.mockResolvedValue([]);
  getFrequencySummaryForStudent.mockResolvedValue({ totalConcluded: 0, last7Days: 0, last30Days: 0 });
  listPersonalRecordsForStudent.mockResolvedValue([]);
  listSessionHistoryForStudent.mockResolvedValue([]);
}

describe("MinhaEvolucaoPage (FIT-104)", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("redireciona para /entrar quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requireIndividual.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { default: MinhaEvolucaoPage } = await import("./page");

    await expect(MinhaEvolucaoPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/entrar");
  });

  it("redireciona para /painel quando o usuário não é individual", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requireIndividual.mockRejectedValue(new AuthError("FORBIDDEN", "Acesso restrito ao workspace individual (FitOS Livre)."));

    const { default: MinhaEvolucaoPage } = await import("./page");

    await expect(MinhaEvolucaoPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/painel");
  });

  it("estado vazio honesto em todas as seções", async () => {
    mockEmptyState();

    const { default: MinhaEvolucaoPage } = await import("./page");
    render(await MinhaEvolucaoPage());

    expect(screen.getByText("Nenhum recorde ainda — registre uma carga numérica ao executar um treino.")).toBeInTheDocument();
    expect(screen.getByText("Nenhum treino concluído ou abandonado ainda.")).toBeInTheDocument();
    expect(screen.getByText("Nenhuma avaliação registrada ainda.")).toBeInTheDocument();
    expect(screen.getByText("Nenhuma meta ainda.")).toBeInTheDocument();
    expect(screen.getByText(/0 treinos concluídos nos últimos 7 dias/)).toBeInTheDocument();
  });

  it("mostra frequência, recordes, histórico e metas com dados reais", async () => {
    mockEmptyState();
    getFrequencySummaryForStudent.mockResolvedValue({ totalConcluded: 5, last7Days: 2, last30Days: 4 });
    listPersonalRecordsForStudent.mockResolvedValue([
      { exerciseName: "Supino", loadUsed: "22,5kg", loadValue: 22.5, repsCompleted: 9, achievedAt: new Date("2026-09-10") },
    ]);
    listSessionHistoryForStudent.mockResolvedValue([
      { id: "sess1", workoutName: "Treino A", status: "CONCLUIDA", startedAt: new Date("2026-09-10"), endedAt: new Date("2026-09-10"), resultsCount: 3 },
    ]);
    listGoalsForStudent.mockResolvedValue([
      { id: "g1", description: "Perder 5kg", status: "EM_ANDAMENTO", targetDate: null, createdAt: new Date(), completedAt: null },
      { id: "g2", description: "Correr 5km", status: "CONCLUIDA", targetDate: null, createdAt: new Date(), completedAt: new Date() },
    ]);

    const { default: MinhaEvolucaoPage } = await import("./page");
    render(await MinhaEvolucaoPage());

    expect(screen.getByText(/2 treinos concluídos nos últimos 7 dias/)).toBeInTheDocument();
    expect(screen.getByText("Supino")).toBeInTheDocument();
    expect(screen.getByText("22,5kg")).toBeInTheDocument();
    expect(screen.getByText("Treino A")).toBeInTheDocument();
    expect(screen.getByText("Perder 5kg")).toBeInTheDocument();
    expect(screen.getByText("Correr 5km")).toBeInTheDocument();
    // Meta EM_ANDAMENTO tem ações; meta CONCLUIDA não.
    expect(screen.getByRole("button", { name: "Concluir" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abandonar" })).toBeInTheDocument();
  });
});
