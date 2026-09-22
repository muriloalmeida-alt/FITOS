import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SelectField } from "./SelectField";

describe("SelectField", () => {
  it("renderiza label e opções, associadas por htmlFor/id", () => {
    render(
      <SelectField
        label="Objetivo"
        name="objective"
        options={[
          { value: "A", label: "Opção A" },
          { value: "B", label: "Opção B" },
        ]}
        value=""
        onChange={() => {}}
      />
    );

    const select = screen.getByLabelText("Objetivo");
    expect(select).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Opção A" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Opção B" })).toBeInTheDocument();
  });

  it("dispara onChange com o valor selecionado", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SelectField
        label="Experiência"
        name="experienceLevel"
        options={[
          { value: "INICIANTE", label: "Iniciante" },
          { value: "AVANCADO", label: "Avançado" },
        ]}
        value="INICIANTE"
        onChange={onChange}
      />
    );

    await user.selectOptions(screen.getByLabelText("Experiência"), "AVANCADO");

    expect(onChange).toHaveBeenCalled();
  });

  it("exibe mensagem de erro associada via aria-describedby", () => {
    render(
      <SelectField
        label="Disponibilidade"
        name="weeklyAvailability"
        options={[{ value: "UM_A_DOIS_DIAS", label: "1 a 2 dias" }]}
        value=""
        onChange={() => {}}
        error="Selecione uma opção."
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Selecione uma opção.");
    expect(screen.getByLabelText("Disponibilidade")).toHaveAttribute("aria-invalid", "true");
  });
});
