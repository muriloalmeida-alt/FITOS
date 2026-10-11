import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ToastProvider } from "@/shared/ui";

vi.mock("@/modules/identity/auth-client", () => ({ signUp: { email: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/modules/billing/plans", () => ({
  listActivePlansForAudience: async (audience: string) =>
    audience === "PERSONAL"
      ? [
          { id: "p20", name: "Personal 20", priceCents: 4990, studentLimit: 20, trialDays: 30 },
          { id: "p50", name: "Personal 50", priceCents: 6990, studentLimit: 50, trialDays: 30 },
        ]
      : [{ id: "livre", name: "FitOS Livre", priceCents: 1990, studentLimit: null, trialDays: 30 }],
}));

async function renderPage(params: Record<string, string> = {}) {
  const { default: Page } = await import("./page");
  render(<ToastProvider>{await Page({ searchParams: Promise.resolve(params) })}</ToastProvider>);
}

describe("Começar (EPIC-33)", () => {
  it("o que você quer fazer: três caminhos pelo resultado", async () => {
    await renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "O que você quer fazer?" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Dar treino aos meus alunos/ })).toHaveAttribute("href", "/comecar?caminho=personal");
    expect(screen.getByRole("link", { name: /Treinar com meu personal/ })).toHaveAttribute("href", "/comecar?caminho=convite");
    expect(screen.getByRole("link", { name: /Treinar por conta/ })).toHaveAttribute("href", "/comecar?caminho=livre");
  });

  it("convite aceita código ou link e oferece Já tenho conta", async () => {
    await renderPage({ caminho: "convite" });
    expect(screen.getByLabelText("Código ou link do convite")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Já tenho conta" })).toHaveAttribute("href", "/entrar");
  });

  it("personal começa por quantos alunos, com o plano de cada faixa", async () => {
    await renderPage({ caminho: "personal" });
    expect(screen.getByRole("heading", { name: "Quantos alunos hoje?" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /21 a 50 alunos.*Personal 50/ })).toBeInTheDocument();
  });

  it("?modo=individual antigo leva ao Livre, que começa pela pergunta", async () => {
    await renderPage({ modo: "individual" });
    expect(screen.getByRole("heading", { name: "O que você quer?" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Seu nome")).not.toBeInTheDocument();
  });
});
