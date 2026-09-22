import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const requireIndividual = vi.fn();
const listWorkoutsForTenant = vi.fn();
const redirect = vi.fn((_url: string) => {
  throw new Error("NEXT_REDIRECT");
});

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requireIndividual: (...args: unknown[]) => requireIndividual(...args) };
});

vi.mock("@/modules/workouts/workouts", async () => {
  const actual = await vi.importActual<typeof import("@/modules/workouts/workouts")>("@/modules/workouts/workouts");
  return { ...actual, listWorkoutsForTenant: (...args: unknown[]) => listWorkoutsForTenant(...args) };
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/modules/identity/auth-client", () => ({
  signOut: vi.fn(),
}));

describe("MeusTreinosPage (FIT-102)", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("redireciona para /entrar quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requireIndividual.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));
    const { default: MeusTreinosPage } = await import("./page");

    await expect(MeusTreinosPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/entrar");
  });

  it("redireciona para /painel quando o usuário autenticado não é individual", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requireIndividual.mockRejectedValue(new AuthError("FORBIDDEN", "Acesso restrito ao workspace individual (FitOS Livre)."));
    const { default: MeusTreinosPage } = await import("./page");

    await expect(MeusTreinosPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/painel");
  });

  it("lista os treinos do tenant", async () => {
    requireIndividual.mockResolvedValue({ userId: "u1", role: "INDIVIDUAL", tenantId: "tenant-real" });
    listWorkoutsForTenant.mockResolvedValue([
      { id: "w1", name: "Treino A" },
      { id: "w2", name: "Treino B" },
    ]);

    const { default: MeusTreinosPage } = await import("./page");
    render(await MeusTreinosPage());

    expect(screen.getByText("Treino A")).toBeInTheDocument();
    expect(screen.getByText("Treino B")).toBeInTheDocument();
    expect(listWorkoutsForTenant).toHaveBeenCalledWith({ tenantId: "tenant-real" });
  });

  it("estado vazio quando não há nenhum treino", async () => {
    requireIndividual.mockResolvedValue({ userId: "u1", role: "INDIVIDUAL", tenantId: "tenant-real" });
    listWorkoutsForTenant.mockResolvedValue([]);

    const { default: MeusTreinosPage } = await import("./page");
    render(await MeusTreinosPage());

    expect(screen.getByText(/Nenhum treino ainda/)).toBeInTheDocument();
  });
});
