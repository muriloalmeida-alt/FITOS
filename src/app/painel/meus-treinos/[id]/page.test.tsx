import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const requireIndividual = vi.fn();
const getWorkoutForTenant = vi.fn();
const listWorkoutExercisesForWorkout = vi.fn();
const listCatalogExercises = vi.fn();
const redirect = vi.fn((_url: string) => {
  throw new Error("NEXT_REDIRECT");
});
const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requireIndividual: (...args: unknown[]) => requireIndividual(...args) };
});

vi.mock("@/modules/workouts/workouts", async () => {
  const actual = await vi.importActual<typeof import("@/modules/workouts/workouts")>("@/modules/workouts/workouts");
  return {
    ...actual,
    getWorkoutForTenant: (...args: unknown[]) => getWorkoutForTenant(...args),
    listWorkoutExercisesForWorkout: (...args: unknown[]) => listWorkoutExercisesForWorkout(...args),
  };
});

vi.mock("@/modules/exercises/exercises", async () => {
  const actual = await vi.importActual<typeof import("@/modules/exercises/exercises")>("@/modules/exercises/exercises");
  return { ...actual, listCatalogExercises: (...args: unknown[]) => listCatalogExercises(...args) };
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

describe("MeuTreinoDetalhePage (FIT-102)", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("redireciona para /entrar quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requireIndividual.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));
    const { default: MeuTreinoDetalhePage } = await import("./page");

    await expect(MeuTreinoDetalhePage({ params: makeParams("w1") })).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/entrar");
  });

  it("chama notFound quando o treino não pertence ao tenant da sessão", async () => {
    requireIndividual.mockResolvedValue({ userId: "u1", role: "INDIVIDUAL", tenantId: "tenant-real" });
    getWorkoutForTenant.mockResolvedValue(null);
    const { default: MeuTreinoDetalhePage } = await import("./page");

    await expect(MeuTreinoDetalhePage({ params: makeParams("w1") })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("mostra dados do treino, itens e ciclo de vida (ativo -> botão de arquivar)", async () => {
    requireIndividual.mockResolvedValue({ userId: "u1", role: "INDIVIDUAL", tenantId: "tenant-real" });
    getWorkoutForTenant.mockResolvedValue({ id: "w1", name: "Treino A", status: "ATIVO" });
    listWorkoutExercisesForWorkout.mockResolvedValue([
      {
        id: "wi1",
        exerciseId: "e1",
        sets: 3,
        reps: 10,
        durationSeconds: null,
        load: "20kg",
        restSeconds: 60,
        notes: null,
        exercise: { name: "Supino", muscle: "peito" },
      },
    ]);
    listCatalogExercises.mockResolvedValue({ items: [{ id: "e1", name: "Supino" }], total: 1, page: 1, pageSize: 100 });

    const { default: MeuTreinoDetalhePage } = await import("./page");
    render(await MeuTreinoDetalhePage({ params: makeParams("w1") }));

    expect(screen.getByText("Ativo")).toBeInTheDocument();
    expect(screen.getAllByText("Supino").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Arquivar treino/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Reativar treino/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Duplicar treino/ })).toBeInTheDocument();
  });

  it("treino arquivado: mostra botão de reativar, não o de arquivar", async () => {
    requireIndividual.mockResolvedValue({ userId: "u1", role: "INDIVIDUAL", tenantId: "tenant-real" });
    getWorkoutForTenant.mockResolvedValue({ id: "w2", name: "Treino B", status: "ARQUIVADO" });
    listWorkoutExercisesForWorkout.mockResolvedValue([]);
    listCatalogExercises.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 100 });

    const { default: MeuTreinoDetalhePage } = await import("./page");
    render(await MeuTreinoDetalhePage({ params: makeParams("w2") }));

    expect(screen.getByText("Arquivado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reativar treino/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Arquivar treino/ })).not.toBeInTheDocument();
  });
});
