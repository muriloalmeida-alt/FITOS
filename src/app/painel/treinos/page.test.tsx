import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const requirePersonal = vi.fn();
const listWorkoutSummariesForTenant = vi.fn();
const redirect = vi.fn((_url: string) => {
  throw new Error("NEXT_REDIRECT");
});

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requirePersonal: (...args: unknown[]) => requirePersonal(...args) };
});
vi.mock("@/modules/workouts/workouts", async () => {
  const actual = await vi.importActual<typeof import("@/modules/workouts/workouts")>("@/modules/workouts/workouts");
  return { ...actual, listWorkoutSummariesForTenant: (...args: unknown[]) => listWorkoutSummariesForTenant(...args) };
});
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/painel/treinos",
}));
vi.mock("@/modules/identity/auth-client", () => ({ signOut: vi.fn() }));

const summary = (id: string, name: string, status = "ATIVO") => ({ id, name, status, suggestedDays: ["SEGUNDA", "QUINTA"], exerciseCount: 5, trainingPlanId: "draft", trainingPlanName: null, thumbnails: [] });

describe("TreinosPage (FIT-146)", () => {
  afterEach(() => vi.resetAllMocks());

  it("redireciona sem sessão e quando não é personal", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    const { default: TreinosPage } = await import("./page");
    requirePersonal.mockRejectedValueOnce(new AuthError("UNAUTHENTICATED", "x"));
    await expect(TreinosPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/entrar");
    requirePersonal.mockRejectedValueOnce(new AuthError("FORBIDDEN", "x"));
    await expect(TreinosPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/painel");
  });

  it("mostra o próximo passo, as abas e os treinos ativos com ações", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "t1" });
    listWorkoutSummariesForTenant.mockImplementation(async ({ status }: { status?: string }) => (status === "ARQUIVADO" ? [summary("w9", "Velho", "ARQUIVADO")] : [summary("w1", "Treino A")]));
    const { default: TreinosPage } = await import("./page");
    render(await TreinosPage());

    expect(screen.getByRole("link", { name: /Montar um treino/ })).toHaveAttribute("href", "/painel/treinos/novo");
    expect(screen.getByRole("link", { name: "Programas" })).toHaveAttribute("href", "/painel/treinos/planos");
    expect(screen.getByRole("link", { name: "Ativos · 1" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Treino A" })).toHaveAttribute("href", "/painel/treinos/w1");
    expect(screen.getByText("5 exercícios · Seg, Qui")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Usar como base" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Arquivar" })).toBeInTheDocument();
    expect(listWorkoutSummariesForTenant).toHaveBeenCalledWith({ tenantId: "t1" });
  });

  it("filtro de arquivados mostra Reativar", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "t1" });
    listWorkoutSummariesForTenant.mockImplementation(async ({ status }: { status?: string }) => (status === "ARQUIVADO" ? [summary("w9", "Velho", "ARQUIVADO")] : []));
    const { default: TreinosPage } = await import("./page");
    render(await TreinosPage({ searchParams: Promise.resolve({ arquivados: "1" }) }));
    expect(screen.getByRole("link", { name: "Arquivados · 1" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Reativar" })).toBeInTheDocument();
  });
});
