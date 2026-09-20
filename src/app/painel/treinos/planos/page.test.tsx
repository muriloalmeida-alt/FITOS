import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const requirePersonal = vi.fn();
const listTrainingPlansForTenant = vi.fn();
const redirect = vi.fn((_url: string) => {
  throw new Error("NEXT_REDIRECT");
});

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requirePersonal: (...args: unknown[]) => requirePersonal(...args) };
});

vi.mock("@/modules/workouts/workouts", async () => {
  const actual = await vi.importActual<typeof import("@/modules/workouts/workouts")>("@/modules/workouts/workouts");
  return { ...actual, listTrainingPlansForTenant: (...args: unknown[]) => listTrainingPlansForTenant(...args) };
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/modules/identity/auth-client", () => ({
  signOut: vi.fn(),
}));

describe("PlanosPage (FIT-032)", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("redireciona para /entrar quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requirePersonal.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));
    const { default: PlanosPage } = await import("./page");

    await expect(PlanosPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/entrar");
  });

  it("redireciona para /painel quando o usuário autenticado não é personal", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requirePersonal.mockRejectedValue(new AuthError("FORBIDDEN", "Acesso restrito a personal."));
    const { default: PlanosPage } = await import("./page");

    await expect(PlanosPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/painel");
  });

  it("lista os programas do tenant", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    listTrainingPlansForTenant.mockResolvedValue([
      { id: "p1", name: "Plano A", durationWeeks: 4 },
      { id: "p2", name: "Plano B", durationWeeks: null },
    ]);

    const { default: PlanosPage } = await import("./page");
    render(await PlanosPage());

    expect(screen.getByText("Plano A")).toBeInTheDocument();
    expect(screen.getByText("Plano B")).toBeInTheDocument();
    expect(listTrainingPlansForTenant).toHaveBeenCalledWith({ tenantId: "tenant-real" });
  });

  it("estado vazio quando não há nenhum programa", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    listTrainingPlansForTenant.mockResolvedValue([]);

    const { default: PlanosPage } = await import("./page");
    render(await PlanosPage());

    expect(screen.getByText(/Nenhum programa ainda/)).toBeInTheDocument();
  });
});
