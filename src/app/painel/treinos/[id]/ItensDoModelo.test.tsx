import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ItensDoModelo, type CatalogExerciseOption, type WorkoutItemProp } from "./ItensDoModelo";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

const CATALOG: CatalogExerciseOption[] = [
  { id: "e1", name: "Supino reto", muscle: "Peito" },
  { id: "e2", name: "Rosca direta", muscle: "Bíceps" },
];

const ITEM: WorkoutItemProp = {
  id: "wi1",
  exerciseId: "e1",
  exerciseName: "Supino reto",
  exerciseMuscle: "Peito",
  sets: 3,
  reps: 10,
  durationSeconds: null,
  load: "20kg",
  restSeconds: 60,
  notes: null,
};

describe("ItensDoModelo (busca por autocomplete em vez de select nativo)", () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
  });

  it("estado vazio: nenhum item ainda", () => {
    render(<ItensDoModelo workoutId="w1" items={[]} catalog={CATALOG} />);
    expect(screen.getByText("Nenhum exercício adicionado ainda.")).toBeInTheDocument();
  });

  it("lista o item existente com o resumo da prescrição", () => {
    render(<ItensDoModelo workoutId="w1" items={[ITEM]} catalog={CATALOG} />);
    expect(screen.getByText("Supino reto")).toBeInTheDocument();
    expect(screen.getByText(/3 séries · 10 repetições · carga: 20kg · descanso: 60s/)).toBeInTheDocument();
  });

  it("busca o exercício por nome no autocomplete e adiciona via POST com o exerciseId certo", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<ItensDoModelo workoutId="w1" items={[]} catalog={CATALOG} />);

    const exerciseInput = screen.getByLabelText("Exercício");
    await user.type(exerciseInput, "rosca");
    await user.click(screen.getByRole("option", { name: /Rosca direta/ }));
    await user.type(screen.getByLabelText("Séries"), "4");
    await user.click(screen.getByRole("button", { name: "Adicionar exercício" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/workouts/w1/itens",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          exerciseId: "e2",
          sets: 4,
          reps: undefined,
          durationSeconds: undefined,
          load: undefined,
          restSeconds: undefined,
          notes: undefined,
        }),
      })
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("rejeita o envio sem selecionar exercício, sem chamar fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<ItensDoModelo workoutId="w1" items={[]} catalog={CATALOG} />);

    await user.click(screen.getByRole("button", { name: "Adicionar exercício" }));

    expect(await screen.findByText("Selecione um exercício.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("remove um item via DELETE", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<ItensDoModelo workoutId="w1" items={[ITEM]} catalog={CATALOG} />);

    await user.click(screen.getByRole("button", { name: "Remover" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/workouts/w1/itens/wi1", { method: "DELETE" });
    expect(refresh).toHaveBeenCalled();
  });
});
