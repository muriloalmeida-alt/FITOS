import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const getServerSession = vi.fn();
const getAuthContext = vi.fn();
const findUniqueTenant = vi.fn();
const findUniqueOrThrowTenant = vi.fn();
const findUniqueStudent = vi.fn();
const findUniqueOrThrowStudent = vi.fn();
const getTodayScheduleForStudent = vi.fn();
const listWorkoutsForTenant = vi.fn();
const getInProgressSessionForStudent = vi.fn();
const listStudents = vi.fn();
const getFinancialSummary = vi.fn();
const getIndividualOnboardingProfile = vi.fn();
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
    tenant: {
      findUnique: (...args: unknown[]) => findUniqueTenant(...args),
      findUniqueOrThrow: (...args: unknown[]) => findUniqueOrThrowTenant(...args),
    },
    student: {
      findUnique: (...args: unknown[]) => findUniqueStudent(...args),
      findUniqueOrThrow: (...args: unknown[]) => findUniqueOrThrowStudent(...args),
    },
  },
}));

vi.mock("@/modules/individual-onboarding/onboarding", async () => {
  const actual = await vi.importActual<typeof import("@/modules/individual-onboarding/onboarding")>(
    "@/modules/individual-onboarding/onboarding"
  );
  return { ...actual, getIndividualOnboardingProfile: (...args: unknown[]) => getIndividualOnboardingProfile(...args) };
});

vi.mock("@/modules/workouts/workouts", async () => {
  const actual = await vi.importActual<typeof import("@/modules/workouts/workouts")>("@/modules/workouts/workouts");
  return {
    ...actual,
    getTodayScheduleForStudent: (...args: unknown[]) => getTodayScheduleForStudent(...args),
    listWorkoutsForTenant: (...args: unknown[]) => listWorkoutsForTenant(...args),
  };
});

vi.mock("@/modules/execution/sessions", async () => {
  const actual = await vi.importActual<typeof import("@/modules/execution/sessions")>("@/modules/execution/sessions");
  return { ...actual, getInProgressSessionForStudent: (...args: unknown[]) => getInProgressSessionForStudent(...args) };
});

vi.mock("@/modules/students/students", async () => {
  const actual = await vi.importActual<typeof import("@/modules/students/students")>("@/modules/students/students");
  return { ...actual, listStudents: (...args: unknown[]) => listStudents(...args) };
});

vi.mock("@/modules/student-finance/charges", async () => {
  const actual = await vi.importActual<typeof import("@/modules/student-finance/charges")>(
    "@/modules/student-finance/charges"
  );
  return { ...actual, getFinancialSummary: (...args: unknown[]) => getFinancialSummary(...args) };
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
    listStudents.mockResolvedValue({ items: [], total: 3, page: 1, pageSize: 1 });
    listWorkoutsForTenant.mockResolvedValue([{ id: "w1" }, { id: "w2" }]);
    getFinancialSummary.mockResolvedValue({ previstoCents: 0, recebidoCents: 0, pendenteCents: 0, atrasadoCents: 0 });
    const { default: PainelPage } = await import("./page");

    render(await PainelPage());

    expect(screen.getByRole("heading", { name: "Início" })).toBeInTheDocument();
    expect(screen.getByText("Espaço de Joana")).toBeInTheDocument();
    expect(screen.getByText("Configurações")).toBeInTheDocument();
    expect(screen.queryByText("Sua conta")).not.toBeInTheDocument();
    expect(findUniqueOrThrowStudent).not.toHaveBeenCalled();
  });

  it("personal vê alunos ativos, treinos ativos e o atrasado do mês atual, nunca dados fictícios", async () => {
    getServerSession.mockResolvedValue({ user: { name: "Joana", email: "joana@example.test", role: "PERSONAL" } });
    getAuthContext.mockResolvedValue({
      authenticated: true,
      userId: "u1",
      role: "PERSONAL",
      tenantId: "t1",
      studentId: null,
    });
    findUniqueTenant.mockResolvedValue({ id: "t1", name: "Espaço de Joana" });
    listStudents.mockResolvedValue({ items: [], total: 5, page: 1, pageSize: 1 });
    listWorkoutsForTenant.mockResolvedValue([{ id: "w1" }, { id: "w2" }, { id: "w3" }]);
    getFinancialSummary.mockResolvedValue({ previstoCents: 0, recebidoCents: 0, pendenteCents: 0, atrasadoCents: 3000 });
    const { default: PainelPage } = await import("./page");

    render(await PainelPage());

    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("R$ 30,00")).toBeInTheDocument();
    expect(listStudents).toHaveBeenCalledWith({ tenantId: "t1", status: "ATIVO", pageSize: 1 });
    expect(listWorkoutsForTenant).toHaveBeenCalledWith({ tenantId: "t1" });
    const call = getFinancialSummary.mock.calls[0]![0];
    expect(call.tenantId).toBe("t1");
    expect(call.referenceMonth.getUTCDate()).toBe(1);
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
    getInProgressSessionForStudent.mockResolvedValue(null);
    const { default: PainelPage } = await import("./page");

    render(await PainelPage());

    expect(screen.getByRole("heading", { name: "Hoje" })).toBeInTheDocument();
    expect(screen.getByText("Joana")).toBeInTheDocument();
    expect(screen.getByText("Espaço de Joana")).toBeInTheDocument();
    expect(findUniqueTenant).not.toHaveBeenCalled();
    expect(findUniqueStudent).not.toHaveBeenCalled();
    expect(getTodayScheduleForStudent).toHaveBeenCalledWith({ tenantId: "t1", studentId: "s1" });
    expect(getInProgressSessionForStudent).toHaveBeenCalledWith({ tenantId: "t1", studentId: "s1" });
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

  it("FIT-101: individual sem onboarding concluído é redirecionado para /onboarding", async () => {
    getServerSession.mockResolvedValue({ user: { name: "Praticante", email: "praticante@example.test", role: "INDIVIDUAL" } });
    getAuthContext.mockResolvedValue({
      authenticated: true,
      userId: "u5",
      role: "INDIVIDUAL",
      tenantId: "t5",
      studentId: null,
    });
    getIndividualOnboardingProfile.mockResolvedValue(null);
    const { default: PainelPage } = await import("./page");

    await expect(PainelPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/onboarding");
    expect(findUniqueOrThrowTenant).not.toHaveBeenCalled();
  });

  it("FIT-101: individual com onboarding concluído vê o shell individual, com a configuração real", async () => {
    getServerSession.mockResolvedValue({ user: { name: "Praticante", email: "praticante@example.test", role: "INDIVIDUAL" } });
    getAuthContext.mockResolvedValue({
      authenticated: true,
      userId: "u5",
      role: "INDIVIDUAL",
      tenantId: "t5",
      studentId: null,
    });
    getIndividualOnboardingProfile.mockResolvedValue({
      id: "p1",
      tenantId: "t5",
      objective: "GANHAR_MASSA",
      experienceLevel: "INICIANTE",
      weeklyAvailability: "TRES_A_QUATRO_DIAS",
    });
    findUniqueOrThrowTenant.mockResolvedValue({ id: "t5", name: "Espaço de Praticante" });
    listWorkoutsForTenant.mockResolvedValue([{ id: "w1" }]);
    findUniqueStudent.mockResolvedValue(null);
    const { default: PainelPage } = await import("./page");

    render(await PainelPage());

    expect(screen.getByRole("heading", { name: "Hoje" })).toBeInTheDocument();
    expect(screen.getByText("Espaço de Praticante")).toBeInTheDocument();
    expect(screen.getByText("Ganhar massa muscular")).toBeInTheDocument();
    expect(screen.getByText("1 treino criado")).toBeInTheDocument();
    expect(screen.queryByText("Treino em andamento")).not.toBeInTheDocument();
    expect(findUniqueOrThrowTenant).toHaveBeenCalledWith({ where: { id: "t5" } });
    expect(listWorkoutsForTenant).toHaveBeenCalledWith({ tenantId: "t5" });
    expect(findUniqueStudent).toHaveBeenCalledWith({ where: { userId: "u5" } });
    expect(getInProgressSessionForStudent).not.toHaveBeenCalled();
  });

  it("FIT-103: individual com Student de auto-referência já criado, mas sem sessão em andamento", async () => {
    getServerSession.mockResolvedValue({ user: { name: "Praticante", email: "praticante@example.test", role: "INDIVIDUAL" } });
    getAuthContext.mockResolvedValue({
      authenticated: true,
      userId: "u5",
      role: "INDIVIDUAL",
      tenantId: "t5",
      studentId: null,
    });
    getIndividualOnboardingProfile.mockResolvedValue({
      id: "p1",
      tenantId: "t5",
      objective: "GANHAR_MASSA",
      experienceLevel: "INICIANTE",
      weeklyAvailability: "TRES_A_QUATRO_DIAS",
    });
    findUniqueOrThrowTenant.mockResolvedValue({ id: "t5", name: "Espaço de Praticante" });
    listWorkoutsForTenant.mockResolvedValue([]);
    findUniqueStudent.mockResolvedValue({ id: "student-auto-referencia" });
    getInProgressSessionForStudent.mockResolvedValue(null);
    const { default: PainelPage } = await import("./page");

    render(await PainelPage());

    expect(screen.queryByText("Treino em andamento")).not.toBeInTheDocument();
    expect(getInProgressSessionForStudent).toHaveBeenCalledWith({ tenantId: "t5", studentId: "student-auto-referencia" });
  });

  it("FIT-103: individual com sessão em andamento vê o banner 'Continuar treino'", async () => {
    getServerSession.mockResolvedValue({ user: { name: "Praticante", email: "praticante@example.test", role: "INDIVIDUAL" } });
    getAuthContext.mockResolvedValue({
      authenticated: true,
      userId: "u5",
      role: "INDIVIDUAL",
      tenantId: "t5",
      studentId: null,
    });
    getIndividualOnboardingProfile.mockResolvedValue({
      id: "p1",
      tenantId: "t5",
      objective: "GANHAR_MASSA",
      experienceLevel: "INICIANTE",
      weeklyAvailability: "TRES_A_QUATRO_DIAS",
    });
    findUniqueOrThrowTenant.mockResolvedValue({ id: "t5", name: "Espaço de Praticante" });
    listWorkoutsForTenant.mockResolvedValue([{ id: "w1" }]);
    findUniqueStudent.mockResolvedValue({ id: "student-auto-referencia" });
    getInProgressSessionForStudent.mockResolvedValue({ id: "sess1", workout: { name: "Treino de Peito" } });
    const { default: PainelPage } = await import("./page");

    render(await PainelPage());

    expect(screen.getByRole("heading", { name: "Treino em andamento" })).toBeInTheDocument();
    expect(screen.getByText("Treino de Peito")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continuar treino" })).toHaveAttribute("href", "/painel/meus-treinos/sessao");
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
