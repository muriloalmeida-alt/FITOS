import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorkoutExerciseCard } from "./WorkoutExerciseCard";

describe("WorkoutExerciseCard", () => {
  it("renderiza nome e meta", () => {
    render(
      <WorkoutExerciseCard
        name="Agachamento livre"
        meta="4 × 10 · 90s descanso"
        thumbnailSrc="/media/exercises/agachamento-livre.webp"
        thumbnailAlt="Agachamento livre"
      />
    );
    expect(screen.getByText("Agachamento livre")).toBeInTheDocument();
    expect(screen.getByText("4 × 10 · 90s descanso")).toBeInTheDocument();
  });

  it("sem thumbnailSrc: usa o mesmo fallback 'Sem imagem' do catálogo", () => {
    render(<WorkoutExerciseCard name="Exercício próprio" meta="3 × 12" thumbnailSrc={null} thumbnailAlt="Exercício próprio" />);
    expect(screen.getByText("Sem imagem")).toBeInTheDocument();
  });

  it("renderiza o slot trailing quando informado", () => {
    render(
      <WorkoutExerciseCard
        name="Remada baixa"
        meta="3 × 12"
        thumbnailSrc={null}
        thumbnailAlt="Remada baixa"
        trailing={<button type="button">•••</button>}
      />
    );
    expect(screen.getByRole("button", { name: "•••" })).toBeInTheDocument();
  });
});
