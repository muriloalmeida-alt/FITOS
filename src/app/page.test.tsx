import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import LandingPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

describe("LandingPage (FIT-110)", () => {
  it("renderiza o cabeçalho com Entrar e Criar conta grátis", () => {
    render(<LandingPage />);
    const enterLinks = screen.getAllByRole("link", { name: "Entrar" });
    expect(enterLinks.length).toBeGreaterThan(0);
    for (const link of enterLinks) {
      expect(link).toHaveAttribute("href", "/entrar");
    }
    expect(screen.getAllByRole("link", { name: /Criar conta grátis/ })[0]).toHaveAttribute("href", "/criar-conta");
  });

  it("renderiza o hero com o texto exato do pacote e os dois CTAs", () => {
    render(<LandingPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Seu trabalho. Em movimento." })).toBeInTheDocument();
    expect(screen.getByText("Gestão fitness, sem peso extra")).toBeInTheDocument();
    expect(
      screen.getByText("Alunos, treinos e evolução em um só lugar. Menos planilha, mais tempo para transformar resultados.")
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Começar agora" })).toHaveAttribute("href", "/criar-conta");
    expect(screen.getByRole("link", { name: "Conhecer o FitOS" })).toHaveAttribute("href", "#recursos");
  });

  it("renderiza os três pilares de benefícios", () => {
    render(<LandingPage />);
    expect(screen.getByText("Alunos sob controle")).toBeInTheDocument();
    expect(screen.getByText("Treinos que evoluem")).toBeInTheDocument();
    expect(screen.getByText("Financeiro simples")).toBeInTheDocument();
  });

  it("renderiza os três caminhos (Personal / Aluno com convite / FitOS Livre) com links reais", () => {
    render(<LandingPage />);
    expect(screen.getByRole("heading", { name: "Sou Personal" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Treino com Personal" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "FitOS Livre" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Conhecer o FitOS Livre" })).toHaveAttribute("href", "/treino-sozinho");
    expect(screen.getByLabelText("Já tem um código de convite?")).toBeInTheDocument();
  });

  it("renderiza a seção Personal/aluno e o CTA final", () => {
    render(<LandingPage />);
    expect(screen.getByText(/O acesso do seu aluno é sempre restrito ao seu espaço/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pronto para colocar sua rotina em movimento?" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Criar meu perfil" })).toHaveAttribute("href", "/criar-conta");
  });

  it("FIT-111: renderiza o teaser da biblioteca ilustrada com a quantidade real, nunca 'quase 100' como se já publicado", () => {
    render(<LandingPage />);
    expect(screen.getByRole("heading", { name: "Biblioteca ilustrada de exercícios" })).toBeInTheDocument();
    expect(screen.getByText(/43 exercícios já ilustrados de um acervo planejado de quase 100/)).toBeInTheDocument();
    expect(screen.getByText(/biblioteca em expansão/)).toBeInTheDocument();
    expect(screen.getByText(/Personal, Aluno vinculado e FitOS Livre/)).toBeInTheDocument();
  });

  it("nunca renderiza um link morto de página legal — só o texto de pendência", () => {
    render(<LandingPage />);
    expect(screen.queryByRole("link", { name: /termos/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /privacidade/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Termos de uso e Política de Privacidade — em preparação/)).toBeInTheDocument();
  });

  it("todas as imagens têm alt text funcional (nunca vazio)", () => {
    render(<LandingPage />);
    const images = screen.getAllByRole("img");
    expect(images.length).toBeGreaterThan(0);
    for (const image of images) {
      expect(image.getAttribute("alt")).toBeTruthy();
    }
  });
});
