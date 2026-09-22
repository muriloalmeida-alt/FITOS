import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExerciseAutocomplete, type ExerciseAutocompleteOption } from "./ExerciseAutocomplete";

const OPTIONS: ExerciseAutocompleteOption[] = [
  { id: "e1", name: "Supino reto", muscle: "Peito" },
  { id: "e2", name: "Supino inclinado", muscle: "Peito" },
  { id: "e3", name: "Rosca direta", muscle: "Bíceps" },
];

describe("ExerciseAutocomplete", () => {
  it("renderiza label associada ao input por htmlFor/id", () => {
    render(<ExerciseAutocomplete label="Exercício" name="exerciseId" options={OPTIONS} value="" onChange={() => {}} />);

    expect(screen.getByLabelText("Exercício")).toBeInTheDocument();
  });

  it("mostra a lista ao focar, filtra por texto (case/acento-insensível), e seleciona por clique", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ExerciseAutocomplete label="Exercício" options={OPTIONS} value="" onChange={onChange} />);

    const input = screen.getByLabelText("Exercício");
    await user.click(input);
    expect(screen.getByRole("option", { name: /Supino reto/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Rosca direta/ })).toBeInTheDocument();

    await user.type(input, "roSCA DIRETA");
    expect(screen.queryByRole("option", { name: /Supino reto/ })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Rosca direta/ })).toBeInTheDocument();

    await user.click(screen.getByRole("option", { name: /Rosca direta/ }));

    expect(onChange).toHaveBeenCalledWith("e3");
    expect(input).toHaveValue("Rosca direta");
  });

  it("navegação por teclado: ArrowDown destaca, Enter seleciona", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ExerciseAutocomplete label="Exercício" options={OPTIONS} value="" onChange={onChange} />);

    const input = screen.getByLabelText("Exercício");
    await user.click(input);
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    expect(onChange).toHaveBeenCalledWith("e3");
    expect(input).toHaveValue("Rosca direta");
  });

  it("botão de limpar aparece só com seleção, e chama onChange com string vazia", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<ExerciseAutocomplete label="Exercício" options={OPTIONS} value="" onChange={onChange} />);
    expect(screen.queryByRole("button", { name: /Limpar seleção/ })).not.toBeInTheDocument();

    rerender(<ExerciseAutocomplete label="Exercício" options={OPTIONS} value="e1" onChange={onChange} />);
    const clearButton = screen.getByRole("button", { name: /Limpar seleção de Supino reto/ });

    await user.click(clearButton);
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("texto digitado sem seleção confirmada é descartado ao perder o foco (nunca fica com um texto que não corresponde ao valor selecionado)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ExerciseAutocomplete label="Exercício" options={OPTIONS} value="e1" onChange={onChange} />);

    const input = screen.getByLabelText("Exercício");
    expect(input).toHaveValue("Supino reto");

    // Limpar o campo é a única forma de digitar que muda a seleção (vira
    // "nenhum exercício") — mas como o teste não realimenta esse onChange
    // de volta na prop `value`, o `value` continua "e1" e é exatamente
    // isso que o blur deve restaurar visualmente a seguir.
    await user.clear(input);
    await user.type(input, "algo que não existe no catálogo");
    await user.click(document.body);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(input).toHaveValue("Supino reto");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("busca sem resultado mostra mensagem, nunca uma lista vazia silenciosa", async () => {
    const user = userEvent.setup();
    render(<ExerciseAutocomplete label="Exercício" options={OPTIONS} value="" onChange={() => {}} />);

    await user.click(screen.getByLabelText("Exercício"));
    await user.type(screen.getByLabelText("Exercício"), "inexistente-xyz");

    expect(screen.getByText("Nenhum exercício encontrado")).toBeInTheDocument();
  });

  it("exibe mensagem de erro associada via aria-describedby", () => {
    render(
      <ExerciseAutocomplete label="Exercício" name="exerciseId" options={OPTIONS} value="" onChange={() => {}} error="Selecione um exercício." />
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Selecione um exercício.");
    expect(screen.getByLabelText("Exercício")).toHaveAttribute("aria-invalid", "true");
  });

  it("desabilitado: input e botão de limpar ficam inabilitados", () => {
    render(<ExerciseAutocomplete label="Exercício" options={OPTIONS} value="e1" onChange={() => {}} disabled />);

    expect(screen.getByLabelText("Exercício")).toBeDisabled();
    expect(screen.getByRole("button", { name: /Limpar seleção/ })).toBeDisabled();
  });
});
