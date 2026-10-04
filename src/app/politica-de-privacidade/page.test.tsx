import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import PoliticaDePrivacidadePage from "./page";

describe("PoliticaDePrivacidadePage (FIT-119)", () => {
  it("mostra o título, o aviso de rascunho e um link real de volta ao início", () => {
    render(<PoliticaDePrivacidadePage />);

    expect(screen.getByRole("heading", { name: "Política de Privacidade", level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/rascunho de trabalho, ainda não revisado/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Voltar ao início/ })).toHaveAttribute("href", "/");
  });

  it("linka para os Termos de Uso", () => {
    render(<PoliticaDePrivacidadePage />);

    expect(screen.getByRole("link", { name: "Termos de Uso" })).toHaveAttribute("href", "/termos-de-uso");
  });
  it("FIT-170: abas Termos e Privacidade, com a atual marcada", () => {
    render(<PoliticaDePrivacidadePage />);
    const tabs = screen.getByRole("navigation", { name: "Documentos legais" });
    expect(within(tabs).getByRole("link", { name: "Privacidade" })).toHaveAttribute("aria-current", "page");
    expect(within(tabs).getByRole("link", { name: "Termos de uso" })).toHaveAttribute("href", "/termos-de-uso");
  });
});
