import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import exerciseImageManifest from "@/modules/exercises/data/manifesto-imagens-exercicios.json";
import LandingPage from "./page";

vi.mock("@/modules/billing/plans", () => ({
  listActivePlansForAudience: vi.fn(async (audience: string) =>
    audience === "PERSONAL"
      ? [
          { id: "p20", priceCents: 4990, trialDays: 30 },
          { id: "p50", priceCents: 6990, trialDays: 30 },
        ]
      : [{ id: "livre", priceCents: 1990, trialDays: 30 }]
  ),
}));

async function renderPage() {
  render(await LandingPage());
}

describe("Conheça o FitOS (FIT-168)", () => {
  it("promessa, Entrar e CTA com o teste grátis real", async () => {
    await renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Menos formulário. Mais treino." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/entrar");
    const ctas = screen.getAllByRole("link", { name: "Começar 30 dias grátis" });
    expect(ctas).toHaveLength(2);
    for (const cta of ctas) expect(cta).toHaveAttribute("href", "/comecar");
  });

  it("três benefícios numerados", async () => {
    await renderPage();
    const list = screen.getByRole("heading", { name: "O que muda no seu dia" }).nextElementSibling!;
    expect(list.querySelectorAll("li")).toHaveLength(3);
    expect(screen.getByText("Treino montado em um minuto")).toBeInTheDocument();
    expect(screen.getByText("Cada série registrada")).toBeInTheDocument();
    expect(screen.getByText("Mensalidade sem planilha")).toBeInTheDocument();
  });

  it("biblioteca com a quantidade real do manifesto e imagens com alt", async () => {
    await renderPage();
    expect(screen.getByText(new RegExp(`^${exerciseImageManifest.length} exercícios com ilustração`))).toBeInTheDocument();
    const images = screen.getAllByRole("img");
    expect(images.length).toBeGreaterThan(0);
    for (const image of images) expect(image.getAttribute("alt")).toBeTruthy();
  });

  it("três caminhos com preço do catálogo", async () => {
    await renderPage();
    expect(screen.getByRole("link", { name: /Sou personal/ })).toHaveAttribute("href", "/comecar?caminho=personal");
    expect(screen.getByText(/A partir de R\$\s49,90 por mês/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Tenho convite/ })).toHaveAttribute("href", "/comecar?caminho=convite");
    expect(screen.getByRole("link", { name: /Treino por conta/ })).toHaveAttribute("href", "/treino-sozinho");
    expect(screen.getByText(/FitOS Livre por R\$\s19,90 por mês/)).toBeInTheDocument();
  });

  it("rodapé com Termos e Privacidade", async () => {
    await renderPage();
    expect(screen.getByRole("link", { name: "Termos de uso" })).toHaveAttribute("href", "/termos-de-uso");
    expect(screen.getByRole("link", { name: "Privacidade" })).toHaveAttribute("href", "/politica-de-privacidade");
  });
});
