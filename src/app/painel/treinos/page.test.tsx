import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const requirePersonal = vi.fn();
const listWorkoutsForTenant = vi.fn();
const redirect = vi.fn((_url: string) => {
  throw new Error("NEXT_REDIRECT");
});

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requirePersonal: (...args: unknown[]) => requirePersonal(...args) };
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

describe("TreinosPage (FIT-030)", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("redireciona para /entrar quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requirePersonal.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));
    const { default: TreinosPage } = await import("./page");

    await expect(TreinosPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/entrar");
  });

  it("redireciona para /painel quando o usuário autenticado não é personal", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requirePersonal.mockRejectedValue(new AuthError("FORBIDDEN", "Acesso restrito a personal."));
    const { default: TreinosPage } = await import("./page");

    await expect(TreinosPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/painel");
  });

  it("lista os modelos de treino do tenant", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    listWorkoutsForTenant.mockResolvedValue([
      { id: "w1", name: "Treino A", suggestedDays: ["SEGUNDA"] },
      { id: "w2", name: "Treino B", suggestedDays: [] },
    ]);

    const { default: TreinosPage } = await import("./page");
    render(await TreinosPage());

    expect(screen.getByText("Treino A")).toBeInTheDocument();
    expect(screen.getByText("Treino B")).toBeInTheDocument();
    expect(listWorkoutsForTenant).toHaveBeenCalledWith({ tenantId: "tenant-real" });
  });

  it("estado vazio quando não há nenhum modelo", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    listWorkoutsForTenant.mockResolvedValue([]);

    const { default: TreinosPage } = await import("./page");
    render(await TreinosPage());

    expect(screen.getByText(/Nenhum modelo de treino ainda/)).toBeInTheDocument();
  });
});
