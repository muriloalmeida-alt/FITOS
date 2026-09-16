import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const requirePersonal = vi.fn();
const getCatalogExerciseForTenant = vi.fn();
const redirect = vi.fn((_url: string) => {
  throw new Error("NEXT_REDIRECT");
});
const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
    "@/modules/tenancy/authContext"
  );
  return { ...actual, requirePersonal: (...args: unknown[]) => requirePersonal(...args) };
});

vi.mock("@/modules/exercises/exercises", async () => {
  const actual = await vi.importActual<typeof import("@/modules/exercises/exercises")>("@/modules/exercises/exercises");
  return { ...actual, getCatalogExerciseForTenant: (...args: unknown[]) => getCatalogExerciseForTenant(...args) };
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

describe("ExercicioDetalhePage (FIT-023)", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("redireciona para /entrar quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
      "@/modules/tenancy/authContext"
    );
    requirePersonal.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));
    const { default: ExercicioDetalhePage } = await import("./page");

    await expect(ExercicioDetalhePage({ params: makeParams("e1") })).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/entrar");
  });

  it("chama notFound quando o exercício não pertence ao catálogo visível ao tenant", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    getCatalogExerciseForTenant.mockResolvedValue(null);
    const { default: ExercicioDetalhePage } = await import("./page");

    await expect(ExercicioDetalhePage({ params: makeParams("e1") })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("exercício global: mostra dados somente leitura, sem formulário de edição nem ciclo de vida", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    getCatalogExerciseForTenant.mockResolvedValue({
      id: "g1",
      name: "Push-up",
      origin: "API_NINJAS",
      status: "ATIVO",
      type: "strength",
      muscle: "chest",
      equipments: null,
      difficulty: "beginner",
      instructions: "Lower your body...",
      safetyInfo: null,
    });

    const { default: ExercicioDetalhePage } = await import("./page");
    render(await ExercicioDetalhePage({ params: makeParams("g1") }));

    expect(screen.getByText("Global")).toBeInTheDocument();
    expect(screen.queryByLabelText("Nome")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Arquivar exercício/ })).not.toBeInTheDocument();
  });

  it("exercício próprio ativo: mostra formulário de edição e botão de arquivar", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    getCatalogExerciseForTenant.mockResolvedValue({
      id: "p1",
      name: "Rosca própria",
      origin: "PERSONAL",
      status: "ATIVO",
      type: null,
      muscle: "bíceps",
      equipments: null,
      difficulty: null,
      instructions: null,
      safetyInfo: null,
    });

    const { default: ExercicioDetalhePage } = await import("./page");
    render(await ExercicioDetalhePage({ params: makeParams("p1") }));

    expect(screen.getByText("Meu exercício")).toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Arquivar exercício/ })).toBeInTheDocument();
  });

  it("exercício próprio arquivado: mostra botão de reativar, não o de arquivar", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    getCatalogExerciseForTenant.mockResolvedValue({
      id: "p2",
      name: "Exercício arquivado",
      origin: "PERSONAL",
      status: "ARQUIVADO",
      type: null,
      muscle: null,
      equipments: null,
      difficulty: null,
      instructions: null,
      safetyInfo: null,
    });

    const { default: ExercicioDetalhePage } = await import("./page");
    render(await ExercicioDetalhePage({ params: makeParams("p2") }));

    expect(screen.getByText("Arquivado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reativar exercício/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Arquivar exercício/ })).not.toBeInTheDocument();
  });
});
