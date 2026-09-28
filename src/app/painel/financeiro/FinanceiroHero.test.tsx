import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FinanceiroHero } from "./FinanceiroHero";

describe("FinanceiroHero", () => {
  it("renderiza a foto (decorativa) e o valor real recebido, nunca um número do print", () => {
    const { container } = render(<FinanceiroHero recebidoCents={428000} />);

    expect(screen.getByText("R$ 4.280,00")).toBeInTheDocument();
    const image = container.querySelector("img");
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute("alt", "");
  });

  it("mantém o valor e o gradiente de marca como o próprio conteúdo se a foto falhar (fallback, não erro)", () => {
    const { container } = render(<FinanceiroHero recebidoCents={0} />);

    const image = container.querySelector("img");
    fireEvent.error(image!);

    expect(container.querySelector("img")).not.toBeInTheDocument();
    expect(screen.getByText("R$ 0,00")).toBeInTheDocument();
  });
});
