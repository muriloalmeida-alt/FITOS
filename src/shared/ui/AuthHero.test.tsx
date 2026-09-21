import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AuthHero } from "./AuthHero";

describe("AuthHero", () => {
  it("renderiza a imagem (decorativa, alt vazio), o eyebrow e o headline", () => {
    const { container } = render(<AuthHero eyebrow="FitOS" headline="Todo progresso começa com movimento." />);

    expect(screen.getByText("FitOS")).toBeInTheDocument();
    expect(screen.getByText("Todo progresso começa com movimento.")).toBeInTheDocument();
    const image = container.querySelector("img");
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute("alt", "");
  });

  it("mantém o gradiente e o PulseLine como o próprio conteúdo se a imagem falhar ao carregar (fallback, não erro)", () => {
    const { container } = render(<AuthHero eyebrow="FitOS" headline="Todo progresso começa com movimento." />);

    const image = container.querySelector("img");
    expect(image).not.toBeNull();
    fireEvent.error(image!);

    expect(container.querySelector("img")).not.toBeInTheDocument();
    expect(screen.getByText("FitOS")).toBeInTheDocument();
    expect(screen.getByText("Todo progresso começa com movimento.")).toBeInTheDocument();
  });
});
