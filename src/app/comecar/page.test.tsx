import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/modules/identity/auth-client", () => ({ signUp: { email: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

async function renderPage(params: Record<string, string> = {}) {
  const { default: Page } = await import("./page");
  render(await Page({ searchParams: Promise.resolve(params) }));
}

describe("ComecarPage (FIT-164)", () => {
  it("três caminhos em cartões", async () => {
    await renderPage();
    expect(screen.getByRole("link", { name: /Sou personal/ })).toHaveAttribute("href", "/comecar?caminho=personal");
    expect(screen.getByRole("link", { name: /Tenho convite/ })).toHaveAttribute("href", "/comecar?caminho=convite");
    expect(screen.getByRole("link", { name: /Treino por conta/ })).toHaveAttribute("href", "/comecar?caminho=livre");
  });

  it("convite aceita código ou link e oferece Já tenho conta", async () => {
    await renderPage({ caminho: "convite" });
    expect(screen.getByLabelText("Código ou link do convite")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Já tenho conta" })).toHaveAttribute("href", "/entrar");
  });

  it("criar conta numa tela, sem Confirmar senha, com termos; ?modo= antigo continua valendo", async () => {
    await renderPage({ modo: "individual" });
    expect(screen.getByText("FitOS Livre")).toBeInTheDocument();
    expect(screen.getByLabelText("Seu nome")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Confirmar senha/)).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });
});
