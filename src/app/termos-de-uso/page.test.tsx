import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import TermosDeUsoPage from "./page";

describe("TermosDeUsoPage (FIT-119)", () => {
  it("mostra o título, o aviso de rascunho e um link real de volta ao início", () => {
    render(<TermosDeUsoPage />);

    expect(screen.getByRole("heading", { name: "Termos de Uso", level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/rascunho de trabalho, ainda não revisado/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Voltar ao início/ })).toHaveAttribute("href", "/");
  });

  it("linka para a Política de Privacidade", () => {
    render(<TermosDeUsoPage />);

    expect(screen.getByRole("link", { name: "Política de Privacidade" })).toHaveAttribute(
      "href",
      "/politica-de-privacidade"
    );
  });
  it("FIT-170: abas Termos e Privacidade, com a atual marcada", () => {
    render(<TermosDeUsoPage />);
    const tabs = screen.getByRole("navigation", { name: "Documentos legais" });
    expect(within(tabs).getByRole("link", { name: "Termos de uso" })).toHaveAttribute("aria-current", "page");
    expect(within(tabs).getByRole("link", { name: "Privacidade" })).toHaveAttribute("href", "/politica-de-privacidade");
  });
});
