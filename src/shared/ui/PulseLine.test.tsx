import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { PulseLine } from "./PulseLine";

describe("PulseLine", () => {
  it("é decorativo (aria-hidden) por padrão, em qualquer variante", () => {
    const { container } = render(<PulseLine variant="brand" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).not.toHaveAttribute("role");
  });

  it("quando recebe label, expõe role=img e aria-label, e deixa de ser aria-hidden", () => {
    const { container } = render(<PulseLine variant="progress" value={40} label="40% da meta concluída" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("role", "img");
    expect(svg).toHaveAttribute("aria-label", "40% da meta concluída");
    expect(svg).not.toHaveAttribute("aria-hidden");
  });

  it("na variante progress, o traçado nunca é a única informação: value fica disponível para o consumidor descrever em texto", () => {
    const { container } = render(<PulseLine variant="progress" value={25} />);
    const path = container.querySelector("path");
    expect(path).toHaveStyle({ strokeDasharray: "240" });
  });

  it("nunca renderiza como bitmap — sempre um <svg> code-native", () => {
    const { container } = render(<PulseLine variant="divider" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(container.querySelector("img")).not.toBeInTheDocument();
  });
});
