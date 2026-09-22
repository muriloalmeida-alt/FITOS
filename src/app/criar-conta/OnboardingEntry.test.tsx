import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { OnboardingEntry } from "./OnboardingEntry";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("OnboardingEntry (FIT-112)", () => {
  it("os três caminhos levam a rotas reais, nenhum contrato novo", () => {
    render(<OnboardingEntry />);

    expect(screen.getByRole("link", { name: "Continuar" })).toHaveAttribute("href", "/criar-conta?modo=personal");
    expect(screen.getByRole("link", { name: "Conhecer o FitOS Livre" })).toHaveAttribute("href", "/treino-sozinho");
    expect(screen.getByLabelText("Já tem um código de convite?")).toBeInTheDocument();
  });

  it("os textos de cada caminho batem com a seção 6 do pacote", () => {
    render(<OnboardingEntry />);

    expect(screen.getByText("Quero gerenciar alunos, treinos e meu negócio.")).toBeInTheDocument();
    expect(screen.getByText("Quero acessar meus treinos e acompanhar minha evolução.")).toBeInTheDocument();
  });
});
