import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const getServerSession = vi.fn();
const getAuthContext = vi.fn();
const getIndividualOnboardingProfile = vi.fn();
const redirect = vi.fn();

vi.mock("@/modules/identity/session", () => ({
  getServerSession: (...args: unknown[]) => getServerSession(...args),
}));

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
    "@/modules/tenancy/authContext"
  );
  return { ...actual, getAuthContext: (...args: unknown[]) => getAuthContext(...args) };
});

vi.mock("@/modules/individual-onboarding/onboarding", async () => {
  const actual = await vi.importActual<typeof import("@/modules/individual-onboarding/onboarding")>(
    "@/modules/individual-onboarding/onboarding"
  );
  return { ...actual, getIndividualOnboardingProfile: (...args: unknown[]) => getIndividualOnboardingProfile(...args) };
});

vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => redirect(...args),
  useRouter: () => ({ push: vi.fn() }),
}));

describe("OnboardingPage (FIT-101)", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("sem sessão: redireciona para /entrar", async () => {
    getServerSession.mockResolvedValue(null);
    getAuthContext.mockResolvedValue({ authenticated: false });

    const { default: OnboardingPage } = await import("./page");
    await OnboardingPage();

    expect(redirect).toHaveBeenCalledWith("/entrar");
  });

  it("sessão autenticada com papel diferente de INDIVIDUAL: redireciona para /painel", async () => {
    getServerSession.mockResolvedValue({ user: { id: "u1" } });
    getAuthContext.mockResolvedValue({ authenticated: true, role: "PERSONAL", userId: "u1", tenantId: "t1", studentId: null });

    const { default: OnboardingPage } = await import("./page");
    await OnboardingPage();

    expect(redirect).toHaveBeenCalledWith("/painel");
  });

  it("individual autenticado: renderiza o formulário, pré-preenchido com o perfil existente", async () => {
    getServerSession.mockResolvedValue({ user: { id: "u1" } });
    getAuthContext.mockResolvedValue({ authenticated: true, role: "INDIVIDUAL", userId: "u1", tenantId: "t1", studentId: null });
    getIndividualOnboardingProfile.mockResolvedValue({
      id: "p1",
      tenantId: "t1",
      objective: "PERDER_PESO",
      experienceLevel: "AVANCADO",
      weeklyAvailability: "CINCO_OU_MAIS_DIAS",
    });

    const { default: OnboardingPage } = await import("./page");
    render(await OnboardingPage());

    expect(screen.getByRole("heading", { name: "Configure seu espaço" })).toBeInTheDocument();
    expect(screen.getByLabelText("Qual seu objetivo principal?")).toHaveValue("PERDER_PESO");
    expect(redirect).not.toHaveBeenCalled();
  });
});
