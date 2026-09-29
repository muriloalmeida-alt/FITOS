import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const requireSubscriber = vi.fn();
const redirect = vi.fn((_url: string) => {
  throw new Error("NEXT_REDIRECT");
});

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
    "@/modules/tenancy/authContext"
  );
  return { ...actual, requireSubscriber: (...args: unknown[]) => requireSubscriber(...args) };
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/modules/identity/auth-client", () => ({
  signOut: vi.fn(),
}));

describe("CadastrarExercicioPage (FIT-023/FIT-142)", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("redireciona para /entrar quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
      "@/modules/tenancy/authContext"
    );
    requireSubscriber.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));
    const { default: CadastrarExercicioPage } = await import("./page");

    await expect(CadastrarExercicioPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/entrar");
  });

  it("redireciona para /painel quando o usuário autenticado é um aluno vinculado a um personal", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
      "@/modules/tenancy/authContext"
    );
    requireSubscriber.mockRejectedValue(new AuthError("FORBIDDEN", "Acesso restrito a personal ou workspace individual."));
    const { default: CadastrarExercicioPage } = await import("./page");

    await expect(CadastrarExercicioPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/painel");
  });

  it("renderiza o formulário de cadastro para personal autenticado", async () => {
    requireSubscriber.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    const { default: CadastrarExercicioPage } = await import("./page");

    render(await CadastrarExercicioPage());

    expect(screen.getByRole("heading", { name: "Novo exercício" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).toBeInTheDocument();
  });

  it("FIT-142: renderiza o mesmo formulário para o workspace individual (FitOS Livre) autenticado", async () => {
    requireSubscriber.mockResolvedValue({ userId: "u9", role: "INDIVIDUAL", tenantId: "tenant-livre" });
    const { default: CadastrarExercicioPage } = await import("./page");

    render(await CadastrarExercicioPage());

    expect(screen.getByRole("heading", { name: "Novo exercício" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).toBeInTheDocument();
  });
});
