import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PersonalHero } from "./PersonalHero";

describe("PersonalHero", () => {
  it("renderiza a imagem (decorativa), a saudação real e as métricas reais sobrepostas", () => {
    const { container } = render(<PersonalHero greeting="Bom dia, Murilo." activeStudentsCount={12} activeWorkoutsCount={4} />);

    expect(screen.getByText("Bom dia, Murilo.")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("alunos ativos")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("treinos ativos")).toBeInTheDocument();
    const image = container.querySelector("img");
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute("alt", "");
  });

  it("mantém a saudação e as métricas como o próprio conteúdo se a imagem falhar (fallback, não erro)", () => {
    const { container } = render(<PersonalHero greeting="Boa tarde, Murilo." activeStudentsCount={0} activeWorkoutsCount={0} />);

    const image = container.querySelector("img");
    fireEvent.error(image!);

    expect(container.querySelector("img")).not.toBeInTheDocument();
    expect(screen.getByText("Boa tarde, Murilo.")).toBeInTheDocument();
  });

  it("singular correto para 1 aluno ativo e 1 treino ativo — nunca 'plural' com valor 1", () => {
    render(<PersonalHero greeting="Boa noite, Murilo." activeStudentsCount={1} activeWorkoutsCount={1} />);

    expect(screen.getByText("aluno ativo")).toBeInTheDocument();
    expect(screen.getByText("treino ativo")).toBeInTheDocument();
  });
});
