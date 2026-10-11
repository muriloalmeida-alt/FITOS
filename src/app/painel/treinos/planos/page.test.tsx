import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const requirePersonal = vi.fn();
const listTrainingPlanSummariesForTenant = vi.fn();
const getTrainingPlanForTenant = vi.fn();
const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requirePersonal: (...args: unknown[]) => requirePersonal(...args) };
});
vi.mock("@/modules/workouts/workouts", async () => {
  const actual = await vi.importActual<typeof import("@/modules/workouts/workouts")>("@/modules/workouts/workouts");
  return {
    ...actual,
    listTrainingPlanSummariesForTenant: (...args: unknown[]) => listTrainingPlanSummariesForTenant(...args),
    getTrainingPlanForTenant: (...args: unknown[]) => getTrainingPlanForTenant(...args),
  };
});
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  notFound: () => notFound(),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/modules/identity/auth-client", () => ({ signOut: vi.fn() }));

describe("Programas (FIT-146)", () => {
  afterEach(() => vi.resetAllMocks());

  it("lista programas com a semana e o próximo passo", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "t1" });
    listTrainingPlanSummariesForTenant.mockImplementation(async ({ status }: { status?: string }) =>
      status === "ARQUIVADO" ? [] : [{ id: "p1", name: "Hipertrofia", status: "ATIVO", durationWeeks: 8, workoutCount: 2, days: ["SEGUNDA", "QUINTA"] }]
    );
    const { default: ProgramasPage } = await import("./page");
    render(await ProgramasPage());
    expect(screen.getByRole("link", { name: /Montar um programa/ })).toHaveAttribute("href", "/painel/treinos/planos/novo");
    expect(screen.getByRole("link", { name: /Hipertrofia/ })).toHaveAttribute("href", "/painel/treinos/planos/p1");
    expect(screen.getByText("8 semanas · 2 treinos · 2 dias por semana")).toBeInTheDocument();
    expect(screen.getByLabelText("Quinta: treino previsto")).toBeInTheDocument();
  });

  it("programa de outro tenant ou rascunho é 404", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "t1" });
    getTrainingPlanForTenant.mockResolvedValue(null);
    const { default: ProgramaPage } = await import("./[id]/page");
    await expect(ProgramaPage({ params: Promise.resolve({ id: "alheio" }) })).rejects.toThrow("NEXT_NOT_FOUND");
    getTrainingPlanForTenant.mockResolvedValue({ id: "d", isDraftBucket: true });
    await expect(ProgramaPage({ params: Promise.resolve({ id: "d" }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
