import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const requirePersonal = vi.fn();
const redirect = vi.fn((_url: string) => {
  throw new Error("NEXT_REDIRECT");
});

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
    "@/modules/tenancy/authContext"
  );
  return { ...actual, requirePersonal: (...args: unknown[]) => requirePersonal(...args) };
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/modules/identity/auth-client", () => ({
  signOut: vi.fn(),
}));

describe("CadastrarExercicioPage (FIT-023)", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("redireciona para /entrar quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
      "@/modules/tenancy/authContext"
    );
    requirePersonal.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));
    const { default: CadastrarExercicioPage } = await import("./page");

    await expect(CadastrarExercicioPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/entrar");
  });

  it("redireciona para /painel quando o usuário autenticado não é personal", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
      "@/modules/tenancy/authContext"
    );
    requirePersonal.mockRejectedValue(new AuthError("FORBIDDEN", "Acesso restrito a personal."));
    const { default: CadastrarExercicioPage } = await import("./page");

    await expect(CadastrarExercicioPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/painel");
  });

  it("renderiza o formulário de cadastro para personal autenticado", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    const { default: CadastrarExercicioPage } = await import("./page");

    render(await CadastrarExercicioPage());

    expect(screen.getByRole("heading", { name: "Cadastrar exercício" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).toBeInTheDocument();
  });
});
