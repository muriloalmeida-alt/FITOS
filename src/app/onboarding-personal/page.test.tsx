import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const getServerSession = vi.fn();
const getAuthContext = vi.fn();
const findUniqueOrThrowTenant = vi.fn();
const redirect = vi.fn((_url: string) => {
  throw new Error("NEXT_REDIRECT");
});

vi.mock("@/modules/identity/session", () => ({
  getServerSession: (...args: unknown[]) => getServerSession(...args),
}));

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, getAuthContext: (...args: unknown[]) => getAuthContext(...args) };
});

vi.mock("@/shared/db/prisma", () => ({
  prisma: { tenant: { findUniqueOrThrow: (...args: unknown[]) => findUniqueOrThrowTenant(...args) } },
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
  useRouter: () => ({ push: vi.fn() }),
}));

describe("OnboardingPersonalPage (FIT-113)", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("sem sessão: redireciona para /entrar", async () => {
    getServerSession.mockResolvedValue(null);
    getAuthContext.mockResolvedValue({ authenticated: false });

    const { default: OnboardingPersonalPage } = await import("./page");

    await expect(OnboardingPersonalPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/entrar");
  });

  it("sessão autenticada com papel diferente de PERSONAL: redireciona para /painel", async () => {
    getServerSession.mockResolvedValue({ user: { id: "u1" } });
    getAuthContext.mockResolvedValue({ authenticated: true, role: "INDIVIDUAL", userId: "u1", tenantId: "t1", studentId: null });

    const { default: OnboardingPersonalPage } = await import("./page");

    await expect(OnboardingPersonalPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/painel");
  });

  it("personal autenticado: renderiza o wizard, pré-preenchido com o nome atual do tenant", async () => {
    getServerSession.mockResolvedValue({ user: { id: "u1" } });
    getAuthContext.mockResolvedValue({ authenticated: true, role: "PERSONAL", userId: "u1", tenantId: "t1", studentId: null });
    findUniqueOrThrowTenant.mockResolvedValue({ id: "t1", name: "Espaço de Fulano" });

    const { default: OnboardingPersonalPage } = await import("./page");
    render(await OnboardingPersonalPage());

    expect(screen.getByText("Passo 1 de 3")).toBeInTheDocument();
    expect(redirect).not.toHaveBeenCalled();
  });
});
