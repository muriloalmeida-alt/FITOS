import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AuthHero } from "./AuthHero";

describe("AuthHero", () => {
  it("renderiza a foto de fundo (decorativa, alt vazio), a marca e o headline", () => {
    const { container } = render(<AuthHero headline="Todo progresso começa com movimento." />);

    expect(screen.getByRole("img", { name: "FitOS" })).toBeInTheDocument();
    expect(screen.getByText("Todo progresso começa com movimento.")).toBeInTheDocument();
    const photo = container.querySelector('img[alt=""]');
    expect(photo).toBeInTheDocument();
  });

  it("aceita eyebrow opcional e uma segunda linha do headline em laranja (FIT-131)", () => {
    render(<AuthHero eyebrow="FitOS Livre" headline="Movimento começa" headlineAccent="com um plano." />);

    expect(screen.getByText("FitOS Livre")).toBeInTheDocument();
    expect(screen.getByText("com um plano.")).toBeInTheDocument();
  });

  it("mantém a marca e o headline como o próprio conteúdo se a foto falhar ao carregar (fallback, não erro)", () => {
    const { container } = render(<AuthHero headline="Todo progresso começa com movimento." />);

    const photo = container.querySelector('img[alt=""]');
    expect(photo).not.toBeNull();
    fireEvent.error(photo!);

    expect(container.querySelector('img[alt=""]')).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "FitOS" })).toBeInTheDocument();
    expect(screen.getByText("Todo progresso começa com movimento.")).toBeInTheDocument();
  });
});
