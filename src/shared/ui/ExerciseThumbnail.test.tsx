import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ExerciseThumbnail } from "./ExerciseThumbnail";

describe("ExerciseThumbnail (FIT-111)", () => {
  it("renderiza a imagem com o alt informado quando há src", () => {
    render(<ExerciseThumbnail src="/media/exercises/agachamento-livre-com-barra.webp" alt="Agachamento livre com barra." width={96} height={96} />);
    const img = screen.getByRole("img", { name: "Agachamento livre com barra." });
    expect(img.tagName).toBe("IMG");
  });

  it("sem src: mostra o placeholder 'Sem imagem', nunca um ícone de imagem quebrada", () => {
    render(<ExerciseThumbnail src={null} alt="Rosca direta com barra." width={96} height={96} />);
    expect(screen.getByRole("img", { name: "Rosca direta com barra." })).toBeInTheDocument();
    expect(screen.getByText("Sem imagem")).toBeInTheDocument();
  });

  it("erro de carregamento (onError): troca para o mesmo placeholder de 'sem imagem'", () => {
    render(<ExerciseThumbnail src="/media/exercises/quebrada.webp" alt="Exercício com imagem quebrada." width={96} height={96} />);
    const img = screen.getByRole("img", { name: "Exercício com imagem quebrada." });

    fireEvent.error(img);

    expect(screen.getByText("Sem imagem")).toBeInTheDocument();
  });
});
