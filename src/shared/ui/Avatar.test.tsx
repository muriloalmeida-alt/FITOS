import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Avatar } from "./Avatar";

describe("Avatar", () => {
  it("mostra as iniciais do primeiro e do último nome, e é decorativo (aria-hidden)", () => {
    render(<Avatar name="Maria Oliveira" />);
    const avatar = screen.getByText("MO");
    expect(avatar).toHaveAttribute("aria-hidden", "true");
  });

  it("usa só a primeira letra quando o nome tem uma única palavra", () => {
    render(<Avatar name="Madonna" />);
    expect(screen.getByText("M")).toBeInTheDocument();
  });
});
