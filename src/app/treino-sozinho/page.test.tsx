import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import TreinoSozinhoPage from "./page";

describe("TreinoSozinhoPage (FIT-101)", () => {
  it("apresenta a proposta de valor e um CTA para o cadastro individual", () => {
    render(<TreinoSozinhoPage />);

    expect(screen.getByRole("heading", { name: "Treino sozinho, sem personal" })).toBeInTheDocument();
    const cta = screen.getByRole("link", { name: "Criar meu espaço individual" });
    expect(cta).toHaveAttribute("href", "/criar-conta?modo=individual");
  });
});
