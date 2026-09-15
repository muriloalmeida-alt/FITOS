import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "./Button";

describe("Button", () => {
  it("renderiza o texto informado", () => {
    render(<Button>Continuar</Button>);
    expect(screen.getByRole("button", { name: "Continuar" })).toBeInTheDocument();
  });

  it("aplica a variante outlined quando solicitada", () => {
    render(<Button variant="outlined">Cancelar</Button>);
    const button = screen.getByRole("button", { name: "Cancelar" });
    expect(button.className).toContain("outlined");
  });
});
