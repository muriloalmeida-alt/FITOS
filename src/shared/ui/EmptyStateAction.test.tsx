import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyStateAction } from "./EmptyStateAction";

describe("EmptyStateAction", () => {
  it("renderiza título e descrição", () => {
    render(<EmptyStateAction title="Nenhum modelo de treino ainda" description="Crie o primeiro para começar a montar planos." />);
    expect(screen.getByText("Nenhum modelo de treino ainda")).toBeInTheDocument();
    expect(screen.getByText("Crie o primeiro para começar a montar planos.")).toBeInTheDocument();
  });

  it("sem action: não renderiza nenhum botão", () => {
    render(<EmptyStateAction title="Nenhum aluno cadastrado ainda" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("action com href: renderiza como link", () => {
    render(<EmptyStateAction title="Nenhum aluno cadastrado ainda" action={{ label: "Cadastrar aluno", href: "/painel/alunos/novo" }} />);
    expect(screen.getByRole("link", { name: "Cadastrar aluno" })).toHaveAttribute("href", "/painel/alunos/novo");
  });

  it("action com onClick: renderiza como botão e dispara o clique", () => {
    const onClick = vi.fn();
    render(<EmptyStateAction title="Nenhum exercício ainda" action={{ label: "Cadastrar exercício", onClick }} />);
    screen.getByRole("button", { name: "Cadastrar exercício" }).click();
    expect(onClick).toHaveBeenCalledOnce();
  });
});
