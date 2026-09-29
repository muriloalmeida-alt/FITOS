import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/modules/identity/auth-client", () => ({
  signIn: { email: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => ({ get: () => null }),
}));

describe("EntrarPage (AjustesLogin)", () => {
  it("mostra marca, frase e formulário sem o título/descrição antigos acima dos campos", async () => {
    const { default: EntrarPage } = await import("./page");
    render(<EntrarPage />);

    expect(screen.getByRole("link", { name: /conheça o FitOS/ })).toHaveAttribute("href", "/conheca");
    expect(screen.getByText("Movimento começa")).toBeInTheDocument();
    expect(screen.getByText("com um plano.")).toBeInTheDocument();
    expect(screen.queryByText(/Acesse sua conta de personal ou aluno/)).not.toBeInTheDocument();
    // "Entrar" só no botão; o h1 existe apenas para leitores de tela.
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Entrar no FitOS");
    expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toBeInTheDocument();
  });

  it("mantém o link de criar conta e não oferece recuperação de senha sem fluxo real", async () => {
    const { default: EntrarPage } = await import("./page");
    render(<EntrarPage />);

    expect(screen.getByRole("link", { name: "Criar conta" })).toHaveAttribute("href", "/comecar");
    expect(screen.queryByText(/Esqueceu a senha/)).not.toBeInTheDocument();
  });
});
