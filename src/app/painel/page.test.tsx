import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const getServerSession = vi.fn();
const getAuthContext = vi.fn();
const findUniqueTenant = vi.fn();
const findUniqueStudent = vi.fn();
const findUniqueOrThrowStudent = vi.fn();
const getTodayScheduleForStudent = vi.fn();
const redirect = vi.fn((_url: string) => {
  throw new Error("NEXT_REDIRECT");
});

vi.mock("@/modules/identity/session", () => ({
  getServerSession: (...args: unknown[]) => getServerSession(...args),
}));

vi.mock("@/modules/tenancy/authContext", () => ({
  getAuthContext: (...args: unknown[]) => getAuthContext(...args),
}));

vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    tenant: { findUnique: (...args: unknown[]) => findUniqueTenant(...args) },
    student: {
      findUnique: (...args: unknown[]) => findUniqueStudent(...args),
      findUniqueOrThrow: (...args: unknown[]) => findUniqueOrThrowStudent(...args),
    },
  },
}));

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

describe("PainelPage (FIT-012)", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("redireciona para /entrar quando não há sessão", async () => {
    getServerSession.mockResolvedValue(null);
    getAuthContext.mockResolvedValue({ authenticated: false });
    const { default: PainelPage } = await import("./page");

    await expect(PainelPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/entrar");
  });

  it("personal autenticado vê o shell de personal, com o tenant real", async () => {
    getServerSession.mockResolvedValue({ user: { name: "Joana", email: "joana@example.test", role: "PERSONAL" } });
    getAuthContext.mockResolvedValue({
      authenticated: true,
      userId: "u1",
      role: "PERSONAL",
      tenantId: "t1",
      studentId: null,
    });
    findUniqueTenant.mockResolvedValue({ id: "t1", name: "Espaço de Joana" });
    const { default: PainelPage } = await import("./page");

    render(await PainelPage());

    expect(screen.getByRole("heading", { name: "Início" })).toBeInTheDocument();
    expect(screen.getByText("Espaço de Joana")).toBeInTheDocument();
    expect(screen.getByText("Configurações")).toBeInTheDocument();
    expect(screen.queryByText("Sua conta")).not.toBeInTheDocument();
    expect(findUniqueOrThrowStudent).not.toHaveBeenCalled();
  });

  it("aluno autenticado e vinculado vê o shell de aluno, com o vínculo real", async () => {
    getServerSession.mockResolvedValue({ user: { name: "Pedro", email: "pedro@example.test", role: "ALUNO" } });
    getAuthContext.mockResolvedValue({
      authenticated: true,
      userId: "u2",
      role: "ALUNO",
      tenantId: "t1",
      studentId: "s1",
    });
    findUniqueOrThrowStudent.mockResolvedValue({
      id: "s1",
      displayName: "Pedro",
      tenant: { name: "Espaço de Joana", owner: { name: "Joana" } },
    });
    getTodayScheduleForStudent.mockResolvedValue({ state: "SEM_PLANO" });
    const { default: PainelPage } = await import("./page");

    render(await PainelPage());

    expect(screen.getByRole("heading", { name: "Hoje" })).toBeInTheDocument();
    expect(screen.getByText("Joana")).toBeInTheDocument();
    expect(screen.getByText("Espaço de Joana")).toBeInTheDocument();
    expect(findUniqueTenant).not.toHaveBeenCalled();
    expect(findUniqueStudent).not.toHaveBeenCalled();
    expect(getTodayScheduleForStudent).toHaveBeenCalledWith({ tenantId: "t1", studentId: "s1" });
  });

  it("aluno autenticado sem vínculo (nunca teve Student) vê a tela de sem permissão, sem shell", async () => {
    getServerSession.mockResolvedValue({ user: { name: "Sem Vínculo", email: "sv@example.test", role: "ALUNO" } });
    getAuthContext.mockResolvedValue({
      authenticated: true,
      userId: "u3",
      role: "ALUNO",
      tenantId: null,
      studentId: null,
    });
    findUniqueStudent.mockResolvedValue(null);
    const { default: PainelPage } = await import("./page");

    render(await PainelPage());

    expect(screen.getByText("Sem vínculo ativo")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Hoje" })).not.toBeInTheDocument();
    expect(findUniqueOrThrowStudent).not.toHaveBeenCalled();
  });

  it("aluno autenticado com vínculo inativado vê a tela de conta inativa, sem shell", async () => {
    getServerSession.mockResolvedValue({ user: { name: "Inativo", email: "inativo@example.test", role: "ALUNO" } });
    getAuthContext.mockResolvedValue({
      authenticated: true,
      userId: "u4",
      role: "ALUNO",
      tenantId: null,
      studentId: null,
    });
    findUniqueStudent.mockResolvedValue({ id: "s4", status: "INATIVO" });
    const { default: PainelPage } = await import("./page");

    render(await PainelPage());

    expect(screen.getByText("Conta inativa")).toBeInTheDocument();
    expect(screen.getByText(/inativada pelo seu personal/)).toBeInTheDocument();
    expect(screen.queryByText("Sem vínculo ativo")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Hoje" })).not.toBeInTheDocument();
    expect(findUniqueOrThrowStudent).not.toHaveBeenCalled();
  });
});
