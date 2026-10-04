import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ToastProvider } from "@/shared/ui";

const requireIndividual = vi.fn();
const ensureStudentForIndividual = vi.fn();
const getInProgressSessionForStudent = vi.fn();
const getLastPerformanceForExercises = vi.fn();
const findWorkout = vi.fn();
const redirect = vi.fn((_url: string) => {
  throw new Error("NEXT_REDIRECT");
});

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requireIndividual: (...args: unknown[]) => requireIndividual(...args) };
});
vi.mock("@/modules/tenancy/ensureStudentForIndividual", () => ({ ensureStudentForIndividual: (...args: unknown[]) => ensureStudentForIndividual(...args) }));
vi.mock("@/modules/execution/sessions", () => ({ getInProgressSessionForStudent: (...args: unknown[]) => getInProgressSessionForStudent(...args) }));
vi.mock("@/modules/execution/sets", () => ({ getLastPerformanceForExercises: (...args: unknown[]) => getLastPerformanceForExercises(...args) }));
vi.mock("@/shared/db/prisma", () => ({ prisma: { workout: { findFirst: (...args: unknown[]) => findWorkout(...args) } } }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirect(url), useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/modules/identity/auth-client", () => ({ signOut: vi.fn() }));

const items = [{ id: "we1", exerciseId: "e1", sets: 3, reps: 12, durationSeconds: null, load: "20 kg", restSeconds: 60, notes: "Sem pressa", exercise: { name: "Remada", instructions: null, imageUrl: null, imageAlt: null } }];

function asIndividual() {
  requireIndividual.mockResolvedValue({ userId: "u1", role: "INDIVIDUAL", tenantId: "t1" });
  ensureStudentForIndividual.mockResolvedValue({ id: "self" });
  getLastPerformanceForExercises.mockResolvedValue(new Map());
}

async function renderPage(searchParams: Record<string, string> = {}) {
  const { default: Page } = await import("./page");
  render(<ToastProvider>{await Page({ searchParams: Promise.resolve(searchParams) })}</ToastProvider>);
}

describe("Treino ao vivo do FitOS Livre (FIT-158)", () => {
  afterEach(() => vi.resetAllMocks());

  it("prepara o treino escolhido, só do próprio tenant", async () => {
    asIndividual();
    getInProgressSessionForStudent.mockResolvedValue(null);
    findWorkout.mockResolvedValue({ id: "w1", name: "Superiores A", workoutExercises: items });
    await renderPage({ treino: "w1" });
    expect(screen.getByRole("heading", { level: 1, name: "Superiores A" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Começar treino" })).toBeInTheDocument();
    expect(findWorkout).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: "w1", tenantId: "t1", status: "ATIVO" }) }));
  });

  it("retoma a sessão em andamento, sem nota de personal", async () => {
    asIndividual();
    getInProgressSessionForStudent.mockResolvedValue({ id: "sess1", workoutId: "w1", startedAt: new Date(), workout: { name: "Superiores A", workoutExercises: items }, setResults: [] });
    await renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Remada" })).toBeInTheDocument();
    expect(screen.getByText("Sem pressa")).toBeInTheDocument();
    expect(getInProgressSessionForStudent).toHaveBeenCalledWith({ tenantId: "t1", studentId: "self" });
  });

  it("sem treino escolhido leva a Meus treinos", async () => {
    asIndividual();
    getInProgressSessionForStudent.mockResolvedValue(null);
    await renderPage();
    expect(screen.getByRole("link", { name: "Meus treinos" })).toHaveAttribute("href", "/painel/meus-treinos");
  });
});
