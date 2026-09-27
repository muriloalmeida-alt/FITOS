import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const getServerSession = vi.fn();
const getAuthContext = vi.fn();
const findUniqueTenant = vi.fn();
const getPersonalOnboardingProfile = vi.fn();
const getSubscriptionForTenant = vi.fn();
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
  },
}));

vi.mock("@/modules/personal-onboarding/onboarding", async () => {
  const actual = await vi.importActual<typeof import("@/modules/personal-onboarding/onboarding")>(
    "@/modules/personal-onboarding/onboarding"
  );
  return { ...actual, getPersonalOnboardingProfile: (...args: unknown[]) => getPersonalOnboardingProfile(...args) };
});

vi.mock("@/modules/billing/subscriptions", async () => {
  const actual = await vi.importActual<typeof import("@/modules/billing/subscriptions")>("@/modules/billing/subscriptions");
  return { ...actual, getSubscriptionForTenant: (...args: unknown[]) => getSubscriptionForTenant(...args) };
});

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

  it("aluno com vínculo ativo vê nome e e-mail da própria conta", async () => {
    getServerSession.mockResolvedValue({
      user: { name: "Pedro", email: "pedro@example.test", role: "ALUNO" },
    });
    getAuthContext.mockResolvedValue({
      authenticated: true,
      userId: "u2",
      role: "ALUNO",
      tenantId: "t1",
      studentId: "s1",
    });
    const { default: PerfilPage } = await import("./page");

    render(await PerfilPage());

    expect(screen.getByRole("heading", { name: "Sua conta" })).toBeInTheDocument();
    expect(screen.getByText("Pedro")).toBeInTheDocument();
    expect(screen.getByText("pedro@example.test")).toBeInTheDocument();
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

  it("individual autenticado é redirecionado para /painel (Perfil ainda não é real para o FitOS Livre)", async () => {
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
    const { default: PerfilPage } = await import("./page");

    await expect(PerfilPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/painel");
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

  it("personal com onboarding concluído vê dados reais: conta, espaço, perfil profissional e assinatura", async () => {
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
    getPersonalOnboardingProfile.mockResolvedValue({
      id: "pp1",
      tenantId: "t1",
      phone: "(11) 99999-9999",
      cref: "012345-G/SP",
      studentRangeEstimate: "DE_21_A_50",
      termsAcceptedAt: new Date(),
    });
    findUniqueTenant.mockResolvedValue({ id: "t1", name: "Espaço de Joana" });
    getSubscriptionForTenant.mockResolvedValue({ plan: { name: "Profissional" } });
    const { default: PerfilPage } = await import("./page");

    render(await PerfilPage());

    expect(screen.getByRole("heading", { name: "Perfil" })).toBeInTheDocument();
    expect(screen.getByText("Joana")).toBeInTheDocument();
    expect(screen.getByText("joana@example.test")).toBeInTheDocument();
    expect(screen.getByText("Espaço de Joana")).toBeInTheDocument();
    expect(screen.getByText("(11) 99999-9999")).toBeInTheDocument();
    expect(screen.getByText("012345-G/SP")).toBeInTheDocument();
    expect(screen.getByText("De 21 a 50 alunos")).toBeInTheDocument();
    expect(screen.getByText("Profissional")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Gerenciar assinatura" })).toHaveAttribute("href", "/painel/assinatura");
  });

  it("personal sem assinatura contratada vê aviso honesto, nunca um plano fabricado", async () => {
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
    getPersonalOnboardingProfile.mockResolvedValue({
      id: "pp1",
      tenantId: "t1",
      phone: "(11) 99999-9999",
      cref: "012345-G/SP",
      studentRangeEstimate: "DE_21_A_50",
      termsAcceptedAt: new Date(),
    });
    findUniqueTenant.mockResolvedValue({ id: "t1", name: "Espaço de Joana" });
    getSubscriptionForTenant.mockResolvedValue(null);
    const { default: PerfilPage } = await import("./page");

    render(await PerfilPage());

    expect(screen.getByText("Nenhuma assinatura contratada ainda.")).toBeInTheDocument();
  });

  it("personal sem CREF informado mostra 'Não informado', nunca um valor vazio ou fabricado", async () => {
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
    getPersonalOnboardingProfile.mockResolvedValue({
      id: "pp1",
      tenantId: "t1",
      phone: "(11) 99999-9999",
      cref: null,
      studentRangeEstimate: "COMECANDO_AGORA",
      termsAcceptedAt: new Date(),
    });
    findUniqueTenant.mockResolvedValue({ id: "t1", name: "Espaço de Joana" });
    const { default: PerfilPage } = await import("./page");

    render(await PerfilPage());

    expect(screen.getByText("Não informado")).toBeInTheDocument();
  });
});
