import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const getServerSession = vi.fn();
const requireStudent = vi.fn();
const redirect = vi.fn((_url: string) => {
  throw new Error("NEXT_REDIRECT");
});

vi.mock("@/modules/identity/session", () => ({
  getServerSession: (...args: unknown[]) => getServerSession(...args),
}));

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
    "@/modules/tenancy/authContext"
  );
  return { ...actual, requireStudent: (...args: unknown[]) => requireStudent(...args) };
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/modules/identity/auth-client", () => ({
  signOut: vi.fn(),
}));

describe("PerfilAlunoPage (FIT-016)", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("redireciona para /entrar quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
      "@/modules/tenancy/authContext"
    );
    getServerSession.mockResolvedValue(null);
    requireStudent.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));
    const { default: PerfilAlunoPage } = await import("./page");

    await expect(PerfilAlunoPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/entrar");
  });

  it("redireciona para /painel quando o usuário autenticado não é aluno com vínculo ativo (ex.: personal alterando a URL)", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
      "@/modules/tenancy/authContext"
    );
    getServerSession.mockResolvedValue({
      user: { name: "Joana", email: "joana@example.test", role: "PERSONAL" },
    });
    requireStudent.mockRejectedValue(new AuthError("FORBIDDEN", "Acesso restrito a aluno com vínculo ativo."));
    const { default: PerfilAlunoPage } = await import("./page");

    await expect(PerfilAlunoPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/painel");
  });

  it("aluno com vínculo ativo vê nome e e-mail da própria conta", async () => {
    getServerSession.mockResolvedValue({
      user: { name: "Pedro", email: "pedro@example.test", role: "ALUNO" },
    });
    requireStudent.mockResolvedValue({ userId: "u2", role: "ALUNO", tenantId: "t1", studentId: "s1" });
    const { default: PerfilAlunoPage } = await import("./page");

    render(await PerfilAlunoPage());

    expect(screen.getByRole("heading", { name: "Sua conta" })).toBeInTheDocument();
    expect(screen.getByText("Pedro")).toBeInTheDocument();
    expect(screen.getByText("pedro@example.test")).toBeInTheDocument();
  });
});
