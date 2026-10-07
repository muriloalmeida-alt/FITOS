import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ToastProvider } from "@/shared/ui";

const requireIndividual = vi.fn();
const listWorkoutSummariesForTenant = vi.fn();
const loadEditorWorkout = vi.fn();
const loadLibrary = vi.fn();
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
vi.mock("@/modules/workouts/workouts", () => ({ listWorkoutSummariesForTenant: (...args: unknown[]) => listWorkoutSummariesForTenant(...args) }));
vi.mock("../_workout-builder/editorData", () => ({ loadEditorWorkout: (...args: unknown[]) => loadEditorWorkout(...args), loadLibrary: (...args: unknown[]) => loadLibrary(...args) }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirect(url), notFound: () => notFound(), useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/modules/identity/auth-client", () => ({ signOut: vi.fn() }));
const getInProgressSessionForStudent = vi.fn();
vi.mock("@/modules/tenancy/ensureStudentForIndividual", () => ({ ensureStudentForIndividual: () => Promise.resolve({ id: "s1" }) }));
vi.mock("@/modules/execution/sessions", () => ({ getInProgressSessionForStudent: (...args: unknown[]) => getInProgressSessionForStudent(...args) }));

const row = { id: "w1", name: "Superiores A", status: "ATIVO", suggestedDays: ["SEGUNDA"], exerciseCount: 3, trainingPlanName: "Meus treinos", thumbnails: [] };

describe("Meus treinos do FitOS Livre (FIT-157)", () => {
  afterEach(() => vi.resetAllMocks());

  it("abas Treinos e Exercícios, sem Programas; cada treino com Começar", async () => {
    requireIndividual.mockResolvedValue({ userId: "u1", role: "INDIVIDUAL", tenantId: "t1" });
    listWorkoutSummariesForTenant.mockImplementation(({ status }: { status?: string }) => Promise.resolve(status === "ARQUIVADO" ? [] : [row]));
    const { default: Page } = await import("./page");
    render(<ToastProvider>{await Page()}</ToastProvider>);

    expect(screen.getByRole("link", { name: "Exercícios" })).toHaveAttribute("href", "/painel/exercicios");
    expect(screen.queryByRole("link", { name: "Programas" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Montar meu treino/ })).toHaveAttribute("href", "/painel/meus-treinos/novo");
    expect(screen.getByRole("link", { name: "Começar" })).toHaveAttribute("href", "/painel/meus-treinos/sessao?treino=w1");
    expect(screen.getByText("3 exercícios · Seg")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Treino avulso/ })).toBeInTheDocument();
  });

  it("com treino em andamento não oferece o treino avulso", async () => {
    requireIndividual.mockResolvedValue({ userId: "u1", role: "INDIVIDUAL", tenantId: "t1" });
    listWorkoutSummariesForTenant.mockResolvedValue([row]);
    getInProgressSessionForStudent.mockResolvedValue({ id: "sess1" });
    const { default: Page } = await import("./page");
    render(<ToastProvider>{await Page()}</ToastProvider>);
    expect(screen.queryByRole("button", { name: /Treino avulso/ })).not.toBeInTheDocument();
  });

  it("editor do Livre: treino de outro tenant é 404 e o novo abre sem formulário", async () => {
    requireIndividual.mockResolvedValue({ userId: "u1", role: "INDIVIDUAL", tenantId: "t1" });
    loadLibrary.mockResolvedValue([]);
    loadEditorWorkout.mockResolvedValue(null);
    const { default: EditPage } = await import("./[id]/page");
    await expect(EditPage({ params: Promise.resolve({ id: "alheio" }) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(loadEditorWorkout).toHaveBeenCalledWith("t1", "alheio");

    const { default: NewPage } = await import("./novo/page");
    render(<ToastProvider>{await NewPage()}</ToastProvider>);
    expect(screen.getByRole("textbox", { name: /Nome do treino/i })).toBeInTheDocument();
  });

  it("personal não entra no Livre", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requireIndividual.mockRejectedValue(new AuthError("FORBIDDEN", "x"));
    const { default: Page } = await import("./page");
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/painel");
  });
});
