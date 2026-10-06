import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const getServerSession = vi.fn();
const getAuthContext = vi.fn();
const findUniqueTenant = vi.fn();
const findUniqueOrThrowTenant = vi.fn();
const findUniqueStudent = vi.fn();
const findUniqueOrThrowStudent = vi.fn();
const getStudentHome = vi.fn();
const getIndividualHome = vi.fn();
const getWeeklyRhythmForStudent = vi.fn();
const listWorkoutsForTenant = vi.fn();
const listWorkoutExercisesForWorkout = vi.fn();
const getInProgressSessionForStudent = vi.fn();
const getFinancialSummary = vi.fn();
const listStudentRoster = vi.fn();
const getPersonalFeed = vi.fn();
const getSubscriptionForTenant = vi.fn();
const countCharges = vi.fn();
const getIndividualOnboardingProfile = vi.fn();
const getPersonalOnboardingProfile = vi.fn();
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
    studentCharge: {
      count: (...args: unknown[]) => countCharges(...args),
      findMany: async () => [],
      findFirst: async () => null,
    },
    healthForm: {
      findFirst: async () => ({ id: "ficha" }),
    },
  },
}));

vi.mock("@/modules/individual-onboarding/onboarding", async () => {
  const actual = await vi.importActual<typeof import("@/modules/individual-onboarding/onboarding")>(
    "@/modules/individual-onboarding/onboarding"
  );
  return { ...actual, getIndividualOnboardingProfile: (...args: unknown[]) => getIndividualOnboardingProfile(...args) };
});

vi.mock("@/modules/personal-onboarding/onboarding", async () => {
  const actual = await vi.importActual<typeof import("@/modules/personal-onboarding/onboarding")>(
    "@/modules/personal-onboarding/onboarding"
  );
  return { ...actual, getPersonalOnboardingProfile: (...args: unknown[]) => getPersonalOnboardingProfile(...args) };
});

vi.mock("@/modules/workouts/workouts", async () => {
  const actual = await vi.importActual<typeof import("@/modules/workouts/workouts")>("@/modules/workouts/workouts");
  return {
    ...actual,
    getWeeklyRhythmForStudent: (...args: unknown[]) => getWeeklyRhythmForStudent(...args),
    listWorkoutsForTenant: (...args: unknown[]) => listWorkoutsForTenant(...args),
    listWorkoutExercisesForWorkout: (...args: unknown[]) => listWorkoutExercisesForWorkout(...args),
  };
});

vi.mock("@/modules/workouts/individualHome", () => ({
  getIndividualHome: (...args: unknown[]) => getIndividualHome(...args),
}));

vi.mock("@/modules/students/studentHome", () => ({
  getStudentHome: (...args: unknown[]) => getStudentHome(...args),
}));

vi.mock("@/modules/execution/sessions", async () => {
  const actual = await vi.importActual<typeof import("@/modules/execution/sessions")>("@/modules/execution/sessions");
  return { ...actual, getInProgressSessionForStudent: (...args: unknown[]) => getInProgressSessionForStudent(...args) };
});

vi.mock("@/modules/student-finance/charges", async () => {
  const actual = await vi.importActual<typeof import("@/modules/student-finance/charges")>(
    "@/modules/student-finance/charges"
  );
  return { ...actual, getFinancialSummary: (...args: unknown[]) => getFinancialSummary(...args), ensureCurrentMonthCharges: async () => ({ created: 0 }) };
});

vi.mock("@/modules/students/roster", async () => {
  const actual = await vi.importActual<typeof import("@/modules/students/roster")>("@/modules/students/roster");
  return { ...actual, listStudentRoster: (...args: unknown[]) => listStudentRoster(...args) };
});

vi.mock("@/modules/students/personalFeed", () => ({
  getPersonalFeed: (...args: unknown[]) => getPersonalFeed(...args),
}));

vi.mock("@/modules/billing/subscriptions", () => ({
  getSubscriptionForTenant: (...args: unknown[]) => getSubscriptionForTenant(...args),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/modules/identity/auth-client", () => ({
  signOut: vi.fn(),
}));

describe("PainelPage (FIT-012)", () => {
  beforeEach(() => {
    getWeeklyRhythmForStudent.mockResolvedValue({
      completedDays: 0,
      targetDays: null,
      dayFlags: [false, false, false, false, false, false, false],
    });
    listWorkoutExercisesForWorkout.mockResolvedValue([]);
  });

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

  it("FIT-113: personal sem perfil profissional concluído é redirecionado para /onboarding-personal", async () => {
    getServerSession.mockResolvedValue({ user: { name: "Joana", email: "joana@example.test", role: "PERSONAL" } });
    getAuthContext.mockResolvedValue({
      authenticated: true,
      userId: "u1",
      role: "PERSONAL",
      tenantId: "t1",
      studentId: null,
    });
    getPersonalOnboardingProfile.mockResolvedValue(null);
    const { default: PainelPage } = await import("./page");

    await expect(PainelPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/onboarding-personal");
  });

  function asPersonal() {
    getServerSession.mockResolvedValue({ user: { name: "Joana", email: "joana@example.test", role: "PERSONAL" } });
    getAuthContext.mockResolvedValue({ authenticated: true, userId: "u1", role: "PERSONAL", tenantId: "t1", studentId: null });
    getPersonalOnboardingProfile.mockResolvedValue({ id: "pp1", tenantId: "t1" });
    getFinancialSummary.mockResolvedValue({ previstoCents: 0, recebidoCents: 120000, pendenteCents: 0, atrasadoCents: 0 });
    countCharges.mockResolvedValue(2);
  }

  const counts = (ativos: number, todos = ativos) => ({ ativos, atencao: 0, convites: 0, inativos: todos - ativos, todos });
  const row = (weekDone: number, weekTarget: number | null) => ({ status: "ATIVO", weekDone, weekTarget });

  it("personal vê o Início com indicadores reais, a faixa da assinatura e o feed (FIT-143)", async () => {
    asPersonal();
    listStudentRoster.mockResolvedValue({ rows: [row(1, 2), row(2, 2)], total: 2, counts: counts(2) });
    getSubscriptionForTenant.mockResolvedValue({ status: "ATIVA", trialEndsAt: new Date(Date.now() + 5 * 86_400_000), plan: { name: "Pro", studentLimit: 15 } });
    getPersonalFeed.mockResolvedValue({
      items: [
        {
          kind: "cobranca_atrasada",
          studentId: "s1",
          studentName: "Diego Santos",
          description: "Cobrança atrasada · R$ 320,00",
          actionLabel: "Registrar pagamento",
          href: "/painel/alunos/s1?acao=receber",
          tone: "error",
          at: null,
        },
      ],
      total: 1,
    });
    const { default: PainelPage } = await import("./page");

    render(await PainelPage());

    expect(screen.getByRole("heading", { level: 1, name: /^(Bom dia|Boa tarde|Boa noite), Joana\.$/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Teste grátis · 5 dias restantes/ })).toHaveAttribute("href", "/painel/assinatura");
    expect(screen.getByText("de 15 do plano")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("R$ 1.200")).toBeInTheDocument();
    expect(screen.getByText("2 atrasadas")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pede você agora" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Recebi" })).toBeInTheDocument();
    expect(listStudentRoster).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "t1", filter: "ativos" }));
    expect(getPersonalFeed).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "t1" }));
    expect(countCharges).toHaveBeenCalledWith({ where: { tenantId: "t1", status: "ATRASADO" } });
    expect(getFinancialSummary.mock.calls[0]![0].referenceMonth.getUTCDate()).toBe(1);
    expect(findUniqueOrThrowStudent).not.toHaveBeenCalled();
  });

  it("espaço novo vê o primeiro passo no lugar do feed, e assinatura cancelada pede para assinar de novo", async () => {
    asPersonal();
    listStudentRoster.mockResolvedValue({ rows: [], total: 0, counts: counts(0) });
    getSubscriptionForTenant.mockResolvedValue({ status: "CANCELADA", trialEndsAt: null, plan: { name: "Pro", studentLimit: 15 } });
    getPersonalFeed.mockResolvedValue({ items: [], total: 0 });
    const { default: PainelPage } = await import("./page");

    render(await PainelPage());

    expect(screen.getByRole("link", { name: /Seu primeiro aluno/ })).toHaveAttribute("href", "/painel/primeiros-passos");
    expect(screen.queryByRole("heading", { name: "Pede você agora" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Assinar de novo/ })).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
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
    getStudentHome.mockResolvedValue({
      hero: { kind: "noPlan", endedPlanName: null },
      program: null,
      week: { planned: [], done: [false, false, false, false, false, false, false], doneCount: 0, target: null },
      upcoming: [],
      lastAssessment: null,
    });
    const { default: PainelPage } = await import("./page");

    render(await PainelPage());

    expect(screen.getByRole("heading", { level: 1, name: /^(Bom dia|Boa tarde|Boa noite), Pedro\.$/ })).toBeInTheDocument();
    expect(screen.getByText(/Joana já foi avisado/)).toBeInTheDocument();
    expect(findUniqueTenant).not.toHaveBeenCalled();
    expect(findUniqueStudent).not.toHaveBeenCalled();
    expect(getStudentHome).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "t1", studentId: "s1" }));
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

    expect(screen.getByRole("heading", { level: 1, name: "Oi, Sem." })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Treinar por conta própria" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Navegação principal" })).not.toBeInTheDocument();
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

  it("individual com onboarding concluído vê o Início do Livre com os dados da própria conta (FIT-156)", async () => {
    getServerSession.mockResolvedValue({ user: { name: "Praticante", email: "praticante@example.test", role: "INDIVIDUAL" } });
    getAuthContext.mockResolvedValue({ authenticated: true, userId: "u5", role: "INDIVIDUAL", tenantId: "t5", studentId: null });
    getIndividualOnboardingProfile.mockResolvedValue({ id: "p1", tenantId: "t5", objective: "GANHAR_MASSA", experienceLevel: "INICIANTE", weeklyAvailability: "TRES_A_QUATRO_DIAS" });
    getIndividualHome.mockResolvedValue({
      today: { id: "w1", name: "Força essencial", exercises: 4, estimatedMinutes: 30, days: [], reason: "rodizio" },
      inProgress: null,
      workouts: [{ id: "w1", name: "Força essencial", exercises: 4, estimatedMinutes: 30, days: [] }],
      week: { done: [false, false, false, false, false, false, false], doneCount: 0, target: 4 },
      monthSessions: 0,
      activeGoals: 0,
      progressions: [],
    });
    const { default: PainelPage } = await import("./page");

    render(await PainelPage());

    expect(screen.getByRole("heading", { level: 1, name: /^(Bom dia|Boa tarde|Boa noite), Praticante\.$/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Iniciar treino" })).toHaveAttribute("href", "/painel/meus-treinos/sessao?treino=w1");
    expect(getIndividualHome).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "t5", userId: "u5" }));
    expect(findUniqueOrThrowTenant).not.toHaveBeenCalled();
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
    findUniqueStudent.mockResolvedValue({ id: "s4", status: "INATIVO", tenant: { owner: { name: "Joana" } } });
    const { default: PainelPage } = await import("./page");

    render(await PainelPage());

    expect(screen.getByRole("heading", { level: 1, name: "Acesso pausado" })).toBeInTheDocument();
    expect(screen.getByText(/Joana pausou seu acesso/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Treinar por conta própria" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: /^(Bom dia|Boa tarde|Boa noite), / })).not.toBeInTheDocument();
    expect(findUniqueOrThrowStudent).not.toHaveBeenCalled();
  });
});
