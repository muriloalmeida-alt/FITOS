import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ToastProvider } from "@/shared/ui";

const getServerSession = vi.fn();
const getAuthContext = vi.fn();
const findUniqueTenant = vi.fn();
const getPersonalOnboardingProfile = vi.fn();
const getSubscriptionForTenant = vi.fn();
const getIndividualOnboardingProfile = vi.fn();
const getFinancialSummary = vi.fn();
const countCharges = vi.fn();
const countExercises = vi.fn();
const findStudentOrThrow = vi.fn();
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
    },
    studentCharge: { count: (...args: unknown[]) => countCharges(...args) },
    exercise: { count: (...args: unknown[]) => countExercises(...args) },
    student: { findUniqueOrThrow: (...args: unknown[]) => findStudentOrThrow(...args), findUnique: async () => ({ preferredDays: [] }) },
    notificationSettings: { findUnique: async () => ({ reminderHour: 7 }) },
    planAssignment: { findFirst: async () => ({ trainingPlan: { workouts: [{ suggestedDays: ["SEGUNDA", "QUARTA"] }] } }) },
    workout: { findMany: async () => [{ suggestedDays: ["TERCA"] }] },
  },
}));

vi.mock("@/modules/personal-onboarding/onboarding", async () => {
  const actual = await vi.importActual<typeof import("@/modules/personal-onboarding/onboarding")>(
    "@/modules/personal-onboarding/onboarding"
  );
  return { ...actual, getPersonalOnboardingProfile: (...args: unknown[]) => getPersonalOnboardingProfile(...args) };
});

vi.mock("@/modules/individual-onboarding/onboarding", async () => {
  const actual = await vi.importActual<typeof import("@/modules/individual-onboarding/onboarding")>(
    "@/modules/individual-onboarding/onboarding"
  );
  return { ...actual, getIndividualOnboardingProfile: (...args: unknown[]) => getIndividualOnboardingProfile(...args) };
});

vi.mock("@/modules/billing/subscriptions", async () => {
  const actual = await vi.importActual<typeof import("@/modules/billing/subscriptions")>("@/modules/billing/subscriptions");
  return { ...actual, getSubscriptionForTenant: (...args: unknown[]) => getSubscriptionForTenant(...args) };
});

vi.mock("@/modules/student-finance/charges", () => ({
  getFinancialSummary: (...args: unknown[]) => getFinancialSummary(...args),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/modules/identity/auth-client", () => ({
  signOut: vi.fn(),
}));

describe("PerfilPage (FIT-016 para o aluno; FIT-120 para o personal)", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("redireciona para /entrar quando não há sessão", async () => {
    getServerSession.mockResolvedValue(null);
    getAuthContext.mockResolvedValue({ authenticated: false });
    const { default: PerfilPage } = await import("./page");

    await expect(PerfilPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/entrar");
  });

  it("aluno vê o personal vinculado, edita nome e e-mail no lugar e tem Termos, Privacidade e Sair (FIT-155)", async () => {
    getServerSession.mockResolvedValue({ user: { name: "Pedro Lima", email: "pedro@example.test", role: "ALUNO" } });
    getAuthContext.mockResolvedValue({ authenticated: true, userId: "u2", role: "ALUNO", tenantId: "t1", studentId: "s1" });
    findStudentOrThrow.mockResolvedValue({ id: "s1", preferredDays: [], tenant: { name: "Studio Joana", owner: { name: "Joana Lima" }, personalProfile: { cref: "123456-G/SP" } } });
    const { default: PerfilPage } = await import("./page");

    render(<ToastProvider>{await PerfilPage()}</ToastProvider>);

    expect(screen.getByText("Joana Lima")).toBeInTheDocument();
    expect(screen.getByText("Studio Joana · CREF 123456-G/SP")).toBeInTheDocument();
    expect(screen.getByText(/Mensalidade e programa são combinados direto com Joana/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Termos de uso" })).toHaveAttribute("href", "/termos-de-uso");
    expect(screen.getAllByRole("button", { name: "Sair" }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Editar e-mail" }));
    const inline = screen.getByRole("group", { name: "E-mail de acesso" });
    expect(within(inline).getByLabelText("Senha atual")).toBeInTheDocument();
    expect(within(inline).getByRole("button", { name: "Salvar" })).toBeDisabled();
    // EPIC-31: lembrete e dias (do programa, enquanto o aluno não escolhe).
    expect(screen.getByText("Nos dias de treino, às 7h")).toBeInTheDocument();
    expect(screen.getByText("seg, qua")).toBeInTheDocument();
  });

  it("aluno autenticado sem vínculo ativo (studentId nulo) é redirecionado para /painel", async () => {
    getServerSession.mockResolvedValue({
      user: { name: "Sem Vínculo", email: "sv@example.test", role: "ALUNO" },
    });
    getAuthContext.mockResolvedValue({
      authenticated: true,
      userId: "u3",
      role: "ALUNO",
      tenantId: null,
      studentId: null,
    });
    const { default: PerfilPage } = await import("./page");

    await expect(PerfilPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/painel");
  });

  it("Livre: respostas em chips no lugar, assinatura com status, dados e nome do espaço (FIT-160)", async () => {
    getServerSession.mockResolvedValue({ user: { name: "Praticante", email: "praticante@example.test", role: "INDIVIDUAL" } });
    getAuthContext.mockResolvedValue({ authenticated: true, userId: "u5", role: "INDIVIDUAL", tenantId: "t5", studentId: null });
    getIndividualOnboardingProfile.mockResolvedValue({ objective: "GANHAR_MASSA", experienceLevel: "INICIANTE", weeklyAvailability: "TRES_A_QUATRO_DIAS" });
    findUniqueTenant.mockResolvedValue({ id: "t5", name: "Espaço de Praticante" });
    getSubscriptionForTenant.mockResolvedValue({ status: "ATIVA", trialEndsAt: null, plan: { name: "FitOS Livre" } });
    const { default: PerfilPage } = await import("./page");
    render(<ToastProvider>{await PerfilPage()}</ToastProvider>);

    expect(screen.getByText("Ganhar massa muscular")).toBeInTheDocument();
    expect(screen.getByText("Iniciante · 3 a 4 dias por semana")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Assinatura.*FitOS Livre · ativa/ })).toHaveAttribute("href", "/painel/assinatura");
    expect(screen.getAllByText("Espaço de Praticante").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Termos de uso" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Editar respostas" }));
    const answers = screen.getByRole("group", { name: "Suas respostas" });
    expect(within(answers).getByRole("radio", { name: "3 a 4 dias por semana" })).toHaveAttribute("aria-checked", "true");
    expect(within(answers).getByRole("radio", { name: "Avançado" })).toBeInTheDocument();
  });

  it("individual sem onboarding concluído é redirecionado para /onboarding", async () => {
    getServerSession.mockResolvedValue({
      user: { name: "Praticante", email: "praticante@example.test", role: "INDIVIDUAL" },
    });
    getAuthContext.mockResolvedValue({
      authenticated: true,
      userId: "u5",
      role: "INDIVIDUAL",
      tenantId: "t5",
      studentId: null,
    });
    getIndividualOnboardingProfile.mockResolvedValue(null);
    const { default: PerfilPage } = await import("./page");

    await expect(PerfilPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/onboarding");
  });

  it("personal sem onboarding profissional concluído é redirecionado para /onboarding-personal", async () => {
    getServerSession.mockResolvedValue({
      user: { name: "Joana", email: "joana@example.test", role: "PERSONAL" },
    });
    getAuthContext.mockResolvedValue({
      authenticated: true,
      userId: "u1",
      role: "PERSONAL",
      tenantId: "t1",
      studentId: null,
    });
    getPersonalOnboardingProfile.mockResolvedValue(null);
    const { default: PerfilPage } = await import("./page");

    await expect(PerfilPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/onboarding-personal");
  });

  function asPersonal(profile: Record<string, unknown> = {}) {
    getServerSession.mockResolvedValue({ user: { name: "Joana Lima", email: "joana@example.test", role: "PERSONAL" } });
    getAuthContext.mockResolvedValue({ authenticated: true, userId: "u1", role: "PERSONAL", tenantId: "t1", studentId: null });
    getPersonalOnboardingProfile.mockResolvedValue({ id: "pp1", tenantId: "t1", phone: "11987654321", cref: "123456-G/SP", studentRangeEstimate: "DE_21_A_50", ...profile });
    findUniqueTenant.mockResolvedValue({ id: "t1", name: "Studio Joana" });
    getFinancialSummary.mockResolvedValue({ previstoCents: 0, recebidoCents: 360000, pendenteCents: 0, atrasadoCents: 0 });
    countCharges.mockResolvedValue(1);
    countExercises.mockResolvedValue(4);
  }

  async function renderPage() {
    const { default: PerfilPage } = await import("./page");
    render(<ToastProvider>{await PerfilPage()}</ToastProvider>);
  }

  it("personal vê 'Seu negócio' com resumos reais e os dados editáveis (FIT-149)", async () => {
    asPersonal();
    getSubscriptionForTenant.mockResolvedValue({ status: "ATIVA", trialEndsAt: null, plan: { name: "Pro" } });
    await renderPage();

    expect(screen.getByRole("link", { name: /^Financeiro.*recebido/ })).toHaveAttribute("href", "/painel/financeiro");
    expect(screen.getByText(/R\$\s3\.600,00 recebido em .+ · 1 atrasada/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Assinatura.*Pro · ativa/ })).toHaveAttribute("href", "/painel/assinatura");
    expect(screen.getByRole("link", { name: /^Exercícios.*Biblioteca do FitOS \+ 4 seus/ })).toHaveAttribute("href", "/painel/exercicios");
    expect(screen.getByText("(11) 98765-4321 · CREF 123456-G/SP · De 21 a 50 alunos")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Termos de uso" })).toHaveAttribute("href", "/termos-de-uso");
    expect(screen.getByRole("link", { name: "Política de privacidade" })).toHaveAttribute("href", "/politica-de-privacidade");
    expect(countExercises).toHaveBeenCalledWith({ where: { tenantId: "t1", status: "ATIVO" } });

    fireEvent.click(screen.getByRole("button", { name: "Editar perfil profissional" }));
    const dialog = screen.getByRole("dialog", { name: "Perfil profissional" });
    expect(within(dialog).getByLabelText("Celular")).toHaveValue("(11) 98765-4321");
    expect(within(dialog).getByRole("radio", { name: "De 21 a 50 alunos" })).toHaveAttribute("aria-checked", "true");
  });

  it("personal sem assinatura e sem CREF vê textos honestos, nunca valores fabricados", async () => {
    asPersonal({ cref: null });
    getSubscriptionForTenant.mockResolvedValue(null);
    await renderPage();

    expect(screen.getByText("Nenhum plano contratado")).toBeInTheDocument();
    expect(screen.getByText(/· sem CREF ·/)).toBeInTheDocument();
  });
});
