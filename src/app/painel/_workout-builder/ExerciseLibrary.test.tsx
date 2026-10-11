import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExerciseLibrary } from "./ExerciseLibrary";
import type { LibraryExercise } from "./types";

const exercises: LibraryExercise[] = [
  { id: "a", name: "Agachamento livre", muscle: "Quadríceps", imageUrl: null, imageAlt: null, categories: ["Funcional"], secondaryMuscles: ["Glúteos"], aliases: ["Air squat"] },
  { id: "b", name: "Thruster", muscle: "Corpo inteiro", imageUrl: null, imageAlt: null, categories: ["CrossFit"], secondaryMuscles: ["Tríceps", "Ombros"], aliases: [] },
  { id: "c", name: "Tríceps na polia", muscle: "Tríceps", imageUrl: null, imageAlt: null },
];

function names() {
  return within(screen.getByRole("list")).queryAllByRole("button").map((button) => button.textContent ?? "");
}

describe("biblioteca do editor: Funcional e CrossFit", () => {
  it("filtra por modalidade, conta o músculo secundário e busca por nome alternativo sem acento", async () => {
    const user = userEvent.setup();
    render(<ExerciseLibrary exercises={exercises} alreadyInWorkout={[]} onClose={vi.fn()} onAdd={vi.fn()} />);
    expect(names()).toHaveLength(3);

    await user.click(screen.getByRole("radio", { name: "CrossFit" }));
    expect(names()).toEqual([expect.stringContaining("Thruster")]);
    await user.click(screen.getByRole("radio", { name: "Todas as modalidades" }));

    await user.click(screen.getByRole("radio", { name: "Tríceps" }));
    expect(names()).toEqual([expect.stringContaining("Thruster"), expect.stringContaining("Tríceps na polia")]);
    await user.click(screen.getAllByRole("radio", { name: "Todos" })[0]);

    await user.type(screen.getByLabelText("Buscar exercício"), "AIR squat");
    expect(names()).toEqual([expect.stringContaining("Agachamento livre")]);
    await user.clear(screen.getByLabelText("Buscar exercício"));
    await user.type(screen.getByLabelText("Buscar exercício"), "triceps");
    expect(names()).toHaveLength(2);
  });
});
