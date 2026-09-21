import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PersonalHero } from "./PersonalHero";

describe("PersonalHero", () => {
  it("renderiza a imagem (decorativa) e a tagline", () => {
    const { container } = render(<PersonalHero />);

    expect(screen.getByText("Sua equipe está em movimento.")).toBeInTheDocument();
    const image = container.querySelector("img");
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute("alt", "");
  });

  it("mantém o gradiente e o PulseLine como o próprio conteúdo se a imagem falhar (fallback, não erro)", () => {
    const { container } = render(<PersonalHero />);

    const image = container.querySelector("img");
    fireEvent.error(image!);

    expect(container.querySelector("img")).not.toBeInTheDocument();
    expect(screen.getByText("Sua equipe está em movimento.")).toBeInTheDocument();
  });
});
