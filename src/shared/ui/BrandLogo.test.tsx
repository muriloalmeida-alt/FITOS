import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrandLogo } from "./BrandLogo";

describe("BrandLogo", () => {
  it("variante horizontal: usa o vetor oficial escuro em fundo escuro (padrão)", () => {
    render(<BrandLogo variant="horizontal" />);
    const img = screen.getByRole("img", { name: "FitOS" });
    expect(img).toHaveAttribute("src", expect.stringContaining("fitos-horizontal-escuro.svg"));
  });

  it("variante horizontal: usa o vetor oficial claro em fundo claro", () => {
    render(<BrandLogo variant="horizontal" background="light" />);
    const img = screen.getByRole("img", { name: "FitOS" });
    expect(img).toHaveAttribute("src", expect.stringContaining("fitos-horizontal-claro.svg"));
  });

  it("variante horizontal: usa o vetor sem retângulo de fundo sobre fotografia (FIT-131)", () => {
    render(<BrandLogo variant="horizontal" background="photo" />);
    const img = screen.getByRole("img", { name: "FitOS" });
    expect(img).toHaveAttribute("src", expect.stringContaining("fitos-horizontal-foto.svg"));
  });

  it("variante horizontal decorativa: sem nome acessível", () => {
    render(<BrandLogo variant="horizontal" decorative />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("variante symbol sem decorative: tem nome acessível", () => {
    render(<BrandLogo variant="symbol" />);
    const img = screen.getByRole("img", { name: "FitOS" });
    expect(img).toHaveAttribute("src", expect.stringContaining("fitos-icone.svg"));
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
