import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const requirePersonal = vi.fn();
const listCatalogExercises = vi.fn();
const redirect = vi.fn((_url: string) => {
  throw new Error("NEXT_REDIRECT");
});

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
    "@/modules/tenancy/authContext"
  );
  return { ...actual, requirePersonal: (...args: unknown[]) => requirePersonal(...args) };
});

vi.mock("@/modules/exercises/exercises", async () => {
  const actual = await vi.importActual<typeof import("@/modules/exercises/exercises")>("@/modules/exercises/exercises");
  return { ...actual, listCatalogExercises: (...args: unknown[]) => listCatalogExercises(...args) };
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/modules/identity/auth-client", () => ({
  signOut: vi.fn(),
}));

function makeSearchParams(params: Record<string, string> = {}) {
  return Promise.resolve(params);
}

describe("ExerciciosPage (FIT-023)", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("redireciona para /entrar quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
      "@/modules/tenancy/authContext"
    );
    requirePersonal.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));
    const { default: ExerciciosPage } = await import("./page");

    await expect(ExerciciosPage({ searchParams: makeSearchParams() })).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/entrar");
  });

  it("redireciona para /painel quando o usuário autenticado não é personal", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
      "@/modules/tenancy/authContext"
    );
    requirePersonal.mockRejectedValue(new AuthError("FORBIDDEN", "Acesso restrito a personal."));
    const { default: ExerciciosPage } = await import("./page");

    await expect(ExerciciosPage({ searchParams: makeSearchParams() })).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/painel");
  });

  it("lista exercícios globais e próprios, com origem visível", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    listCatalogExercises.mockResolvedValue({
      items: [
        { id: "g1", name: "Push-up", muscle: "chest", origin: "API_NINJAS", status: "ATIVO" },
        { id: "p1", name: "Rosca própria", muscle: "bíceps", origin: "PERSONAL", status: "ATIVO" },
      ],
      total: 2,
      page: 1,
      pageSize: 20,
    });

    const { default: ExerciciosPage } = await import("./page");
    render(await ExerciciosPage({ searchParams: makeSearchParams() }));

    expect(screen.getByText("Push-up")).toBeInTheDocument();
    expect(screen.getByText("Rosca própria")).toBeInTheDocument();
    expect(screen.getByText("Global")).toBeInTheDocument();
    expect(screen.getByText("Meu exercício")).toBeInTheDocument();
    expect(listCatalogExercises).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "tenant-real" })
    );
  });

  it("IMP-EX-002: exercício de origem FITOS_CURATED também é mostrado como Global, não Meu exercício", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    listCatalogExercises.mockResolvedValue({
      items: [{ id: "c1", name: "Rosca alta no cabo", muscle: "Bíceps", origin: "FITOS_CURATED", status: "ATIVO" }],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    const { default: ExerciciosPage } = await import("./page");
    render(await ExerciciosPage({ searchParams: makeSearchParams() }));

    expect(screen.getByText("Rosca alta no cabo")).toBeInTheDocument();
    expect(screen.getByText("Global")).toBeInTheDocument();
    expect(screen.queryByText("Meu exercício")).not.toBeInTheDocument();
  });

  it("estado vazio honesto quando não há resultado", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    listCatalogExercises.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });

    const { default: ExerciciosPage } = await import("./page");
    render(await ExerciciosPage({ searchParams: makeSearchParams() }));

    expect(screen.getByText(/Nenhum exercício no catálogo ainda/)).toBeInTheDocument();
  });

  it("estado de sem resultado (com filtro) é distinto do catálogo vazio", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    listCatalogExercises.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });

    const { default: ExerciciosPage } = await import("./page");
    render(await ExerciciosPage({ searchParams: makeSearchParams({ q: "algo" }) }));

    expect(screen.getByText("Nenhum resultado para essa busca.")).toBeInTheDocument();
  });

  it("repassa busca e filtros para listCatalogExercises, nunca um tenantId de query string", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    listCatalogExercises.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });

    const { default: ExerciciosPage } = await import("./page");
    await ExerciciosPage({
      searchParams: makeSearchParams({ q: "supino", muscle: "peito", tenantId: "tenant-adulterado" }),
    });

    expect(listCatalogExercises).toHaveBeenCalledWith({
      tenantId: "tenant-real",
      search: "supino",
      muscle: "peito",
      type: undefined,
      difficulty: undefined,
      page: 1,
      pageSize: 20,
    });
  });
});
