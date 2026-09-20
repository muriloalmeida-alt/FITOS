import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const requireStudent = vi.fn();
const getInProgressSessionForStudent = vi.fn();
const getTodayScheduleForStudent = vi.fn();
const redirect = vi.fn((_url: string) => {
  throw new Error("NEXT_REDIRECT");
});

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
    "@/modules/tenancy/authContext"
  );
  return { ...actual, requireStudent: (...args: unknown[]) => requireStudent(...args) };
});

vi.mock("@/modules/execution/sessions", async () => {
  const actual = await vi.importActual<typeof import("@/modules/execution/sessions")>("@/modules/execution/sessions");
  return { ...actual, getInProgressSessionForStudent: (...args: unknown[]) => getInProgressSessionForStudent(...args) };
});

vi.mock("@/modules/workouts/workouts", async () => {
  const actual = await vi.importActual<typeof import("@/modules/workouts/workouts")>("@/modules/workouts/workouts");
  return { ...actual, getTodayScheduleForStudent: (...args: unknown[]) => getTodayScheduleForStudent(...args) };
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/modules/identity/auth-client", () => ({
  signOut: vi.fn(),
}));

describe("SessaoPage (FIT-041)", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("redireciona para /entrar quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
      "@/modules/tenancy/authContext"
    );
    requireStudent.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { default: SessaoPage } = await import("./page");

    await expect(SessaoPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/entrar");
  });

  it("redireciona para /painel quando o usuário não é aluno com vínculo ativo", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
      "@/modules/tenancy/authContext"
    );
    requireStudent.mockRejectedValue(new AuthError("FORBIDDEN", "Acesso restrito a aluno com vínculo ativo."));

    const { default: SessaoPage } = await import("./page");

    await expect(SessaoPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/painel");
  });

  it("mostra a execução quando há sessão em andamento (continuar)", async () => {
    requireStudent.mockResolvedValue({ userId: "u1", role: "ALUNO", tenantId: "t1", studentId: "s1" });
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

    const { default: SessaoPage } = await import("./page");
    render(await SessaoPage());

    expect(screen.getByRole("heading", { name: "Treino A" })).toBeInTheDocument();
    expect(screen.getByText("Supino")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Concluir treino" })).toBeInTheDocument();
    expect(getTodayScheduleForStudent).not.toHaveBeenCalled();
  });

  it("mostra 'Começar treino' quando não há sessão em andamento mas há treino previsto para hoje", async () => {
    requireStudent.mockResolvedValue({ userId: "u1", role: "ALUNO", tenantId: "t1", studentId: "s1" });
    getInProgressSessionForStudent.mockResolvedValue(null);
    getTodayScheduleForStudent.mockResolvedValue({ state: "TREINO_HOJE", workout: { id: "w1", name: "Treino A" } });

    const { default: SessaoPage } = await import("./page");
    render(await SessaoPage());

    expect(screen.getByRole("heading", { name: "Treino A" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Começar treino" })).toBeInTheDocument();
  });

  it("mostra o estado honesto quando não há nada para iniciar (sem plano)", async () => {
    requireStudent.mockResolvedValue({ userId: "u1", role: "ALUNO", tenantId: "t1", studentId: "s1" });
    getInProgressSessionForStudent.mockResolvedValue(null);
    getTodayScheduleForStudent.mockResolvedValue({ state: "SEM_PLANO" });

    const { default: SessaoPage } = await import("./page");
    render(await SessaoPage());

    expect(
      screen.getByText("Você ainda não tem um programa de treino atribuído. Fale com seu personal.")
    ).toBeInTheDocument();
  });

  it("mostra o estado honesto de descanso", async () => {
    requireStudent.mockResolvedValue({ userId: "u1", role: "ALUNO", tenantId: "t1", studentId: "s1" });
    getInProgressSessionForStudent.mockResolvedValue(null);
    getTodayScheduleForStudent.mockResolvedValue({ state: "DESCANSO" });

    const { default: SessaoPage } = await import("./page");
    render(await SessaoPage());

    expect(screen.getByText("Hoje é dia de descanso. Nenhum treino previsto para hoje.")).toBeInTheDocument();
  });
});
