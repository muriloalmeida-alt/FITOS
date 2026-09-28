import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { NavIcon, type NavIconName } from "./NavIcon";

const ALL_NAMES: NavIconName[] = [
  "inicio",
  "alunos",
  "treinos",
  "evolucao",
  "perfil",
  "mais",
  "exercicios",
  "financeiro",
  "assinatura",
  "config",
];

describe("NavIcon", () => {
  it.each(ALL_NAMES)("renderiza o ícone '%s' como SVG decorativo com currentColor", (name) => {
    const { container } = render(<NavIcon name={name} />);
    const svg = container.querySelector("svg");

    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("stroke", "currentColor");
    expect(svg?.children.length).toBeGreaterThan(0);
  });
});
