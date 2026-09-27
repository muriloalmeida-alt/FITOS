import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StudentCard } from "./StudentCard";

describe("StudentCard", () => {
  it("renderiza nome, descrição e status (texto, não só cor)", () => {
    render(<StudentCard name="Camila Souza" description="Treinou hoje · força" statusLabel="Ativa" statusTone="positive" />);
    expect(screen.getByText("Camila Souza")).toBeInTheDocument();
    expect(screen.getByText("Treinou hoje · força")).toBeInTheDocument();
    expect(screen.getByText("Ativa")).toBeInTheDocument();
  });

  it("mostra iniciais no lugar de foto (Avatar), nunca uma imagem de banco", () => {
    render(<StudentCard name="Lucas Pereira" statusLabel="Atenção" statusTone="warning" />);
    expect(screen.getByText("LP")).toBeInTheDocument();
  });

  it("com href: renderiza como link para o perfil do aluno", () => {
    render(<StudentCard name="Bruno Lima" statusLabel="Ativo" statusTone="positive" href="/painel/alunos/123" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/painel/alunos/123");
  });

  it("sem href: não é um elemento interativo", () => {
    render(<StudentCard name="Bruno Lima" statusLabel="Ativo" statusTone="positive" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
