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

  it("com href, renderiza um único link — nunca um botão aninhado dentro de um link (achado de acessibilidade da FIT-070)", () => {
    render(<Button href="/painel/alunos/novo">+ Cadastrar aluno</Button>);
    const link = screen.getByRole("link", { name: "+ Cadastrar aluno" });
    expect(link).toHaveAttribute("href", "/painel/alunos/novo");
    expect(link.className).toContain("filled");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
