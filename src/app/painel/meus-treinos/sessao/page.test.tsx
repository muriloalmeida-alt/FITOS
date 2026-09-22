import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const requireIndividual = vi.fn();
const ensureStudentForIndividual = vi.fn();
const getInProgressSessionForStudent = vi.fn();
const redirect = vi.fn((_url: string) => {
  throw new Error("NEXT_REDIRECT");
});

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requireIndividual: (...args: unknown[]) => requireIndividual(...args) };
});

vi.mock("@/modules/tenancy/ensureStudentForIndividual", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/ensureStudentForIndividual")>(
    "@/modules/tenancy/ensureStudentForIndividual"
  );
  return { ...actual, ensureStudentForIndividual: (...args: unknown[]) => ensureStudentForIndividual(...args) };
});

vi.mock("@/modules/execution/sessions", async () => {
  const actual = await vi.importActual<typeof import("@/modules/execution/sessions")>("@/modules/execution/sessions");
  return { ...actual, getInProgressSessionForStudent: (...args: unknown[]) => getInProgressSessionForStudent(...args) };
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/modules/identity/auth-client", () => ({
  signOut: vi.fn(),
}));

describe("SessaoIndividualPage (FIT-103)", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("redireciona para /entrar quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requireIndividual.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { default: SessaoIndividualPage } = await import("./page");

    await expect(SessaoIndividualPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/entrar");
  });

  it("redireciona para /painel quando o usuário não é individual", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requireIndividual.mockRejectedValue(new AuthError("FORBIDDEN", "Acesso restrito ao workspace individual (FitOS Livre)."));

    const { default: SessaoIndividualPage } = await import("./page");

    await expect(SessaoIndividualPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/painel");
  });

  it("mostra a execução quando há sessão em andamento (continuar)", async () => {
    requireIndividual.mockResolvedValue({ userId: "u1", role: "INDIVIDUAL", tenantId: "t1" });
    ensureStudentForIndividual.mockResolvedValue({ id: "student-auto-referencia" });
    getInProgressSessionForStudent.mockResolvedValue({
      id: "sess1",
      workout: {
        name: "Treino A",
        workoutExercises: [
          {
            id: "i1",
            sets: 3,
            reps: 10,
            durationSeconds: null,
            load: null,
            restSeconds: null,
            notes: null,
            exercise: { name: "Supino", muscle: "Peito", instructions: null },
          },
        ],
      },
      results: [],
    });

    const { default: SessaoIndividualPage } = await import("./page");
    render(await SessaoIndividualPage());

    expect(screen.getByRole("heading", { name: "Treino A" })).toBeInTheDocument();
    expect(screen.getByText("Supino")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Concluir treino" })).toBeInTheDocument();
    expect(getInProgressSessionForStudent).toHaveBeenCalledWith({ tenantId: "t1", studentId: "student-auto-referencia" });
  });

  it("mostra o estado honesto quando não há sessão em andamento (começar a partir de Meus treinos)", async () => {
    requireIndividual.mockResolvedValue({ userId: "u1", role: "INDIVIDUAL", tenantId: "t1" });
    ensureStudentForIndividual.mockResolvedValue({ id: "student-auto-referencia" });
    getInProgressSessionForStudent.mockResolvedValue(null);

    const { default: SessaoIndividualPage } = await import("./page");
    render(await SessaoIndividualPage());

    expect(screen.getByRole("heading", { name: "Nenhuma sessão em andamento" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Meus treinos" })).toHaveAttribute("href", "/painel/meus-treinos");
  });
});
