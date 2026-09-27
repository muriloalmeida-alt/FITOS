import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
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
});
