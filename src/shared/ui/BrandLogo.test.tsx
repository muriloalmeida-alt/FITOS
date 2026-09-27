import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrandLogo } from "./BrandLogo";

describe("BrandLogo", () => {
  it("variante horizontal: renderiza o texto real 'Fit' + 'OS', acessível por si só", () => {
    render(<BrandLogo variant="horizontal" />);
    expect(screen.getByText("Fit")).toBeInTheDocument();
    expect(screen.getByText("OS")).toBeInTheDocument();
  });

  it("variante horizontal: o símbolo ao lado do texto é sempre decorativo", () => {
    const { container } = render(<BrandLogo variant="horizontal" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("variante symbol sem decorative: tem nome acessível (role=img + aria-label)", () => {
    render(<BrandLogo variant="symbol" />);
    expect(screen.getByRole("img", { name: "FitOS" })).toBeInTheDocument();
  });

  it("variante symbol com decorative=true: some do papel acessível", () => {
    render(<BrandLogo variant="symbol" decorative />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("variante symbol aceita título customizado", () => {
    render(<BrandLogo variant="symbol" title="FitOS — voltar ao início" />);
    expect(screen.getByRole("img", { name: "FitOS — voltar ao início" })).toBeInTheDocument();
  });
});
