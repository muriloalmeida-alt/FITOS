import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/modules/identity/auth-client", () => ({
  signIn: { email: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => ({ get: () => null }),
}));

describe("EntrarPage (FIT-163)", () => {
  it("e-mail e senha com Mostrar, Começar agora, Recebi um convite e rodapé legal", async () => {
    const { default: EntrarPage } = await import("./page");
    render(<EntrarPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Entrar" })).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Mostrar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Começar agora" })).toHaveAttribute("href", "/comecar");
    expect(screen.getByRole("link", { name: "Recebi um convite" })).toHaveAttribute("href", "/comecar?caminho=convite");
    expect(screen.getByRole("link", { name: "Termos de uso" })).toHaveAttribute("href", "/termos-de-uso");
    expect(screen.getByRole("link", { name: "Privacidade" })).toHaveAttribute("href", "/politica-de-privacidade");
    expect(screen.queryByText(/Esqueceu a senha|Esqueci minha senha/)).not.toBeInTheDocument();
  });
});
