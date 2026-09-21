import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const requirePersonal = vi.fn();
const getTrainingPlanForTenant = vi.fn();
const listWorkoutsInPlan = vi.fn();
const listWorkoutsAvailableForPlan = vi.fn();
const redirect = vi.fn((_url: string) => {
  throw new Error("NEXT_REDIRECT");
});
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
    getTrainingPlanForTenant: (...args: unknown[]) => getTrainingPlanForTenant(...args),
    listWorkoutsInPlan: (...args: unknown[]) => listWorkoutsInPlan(...args),
    listWorkoutsAvailableForPlan: (...args: unknown[]) => listWorkoutsAvailableForPlan(...args),
  };
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
  notFound: () => notFound(),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/modules/identity/auth-client", () => ({
  signOut: vi.fn(),
}));

function makeParams(id: string) {
  return Promise.resolve({ id });
}

describe("PlanoDetalhePage (FIT-032)", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("redireciona para /entrar quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requirePersonal.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));
    const { default: PlanoDetalhePage } = await import("./page");

    await expect(PlanoDetalhePage({ params: makeParams("p1") })).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/entrar");
  });

  it("chama notFound quando o plano não pertence ao tenant da sessão", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    getTrainingPlanForTenant.mockResolvedValue(null);
    const { default: PlanoDetalhePage } = await import("./page");

    await expect(PlanoDetalhePage({ params: makeParams("p1") })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("mostra dados do plano, modelos agrupados e ciclo de vida (ativo -> botão de arquivar)", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    getTrainingPlanForTenant.mockResolvedValue({ id: "p1", name: "Plano A", status: "ATIVO", durationWeeks: 4 });
    listWorkoutsInPlan.mockResolvedValue([{ id: "w1", name: "Treino A", suggestedDays: ["SEGUNDA"] }]);
    listWorkoutsAvailableForPlan.mockResolvedValue([{ id: "w2", name: "Treino B" }]);

    const { default: PlanoDetalhePage } = await import("./page");
    render(await PlanoDetalhePage({ params: makeParams("p1") }));

    expect(screen.getByText("Ativo")).toBeInTheDocument();
    expect(screen.getByText("Treino A")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Arquivar programa/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Reativar programa/ })).not.toBeInTheDocument();
  });

  it("plano arquivado: mostra botão de reativar, não o de arquivar", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    getTrainingPlanForTenant.mockResolvedValue({ id: "p2", name: "Plano B", status: "ARQUIVADO", durationWeeks: null });
    listWorkoutsInPlan.mockResolvedValue([]);
    listWorkoutsAvailableForPlan.mockResolvedValue([]);

    const { default: PlanoDetalhePage } = await import("./page");
    render(await PlanoDetalhePage({ params: makeParams("p2") }));

    expect(screen.getByText("Arquivado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reativar programa/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Arquivar programa/ })).not.toBeInTheDocument();
  });
});
