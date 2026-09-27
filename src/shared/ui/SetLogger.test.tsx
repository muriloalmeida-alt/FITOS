import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SetLogger } from "./SetLogger";

describe("SetLogger", () => {
  it("renderiza progresso, reps e carga", () => {
    render(<SetLogger currentSet={2} totalSets={4} reps={10} load="80 kg" onComplete={vi.fn()} />);
    expect(screen.getByText("2 de 4")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("80 kg")).toBeInTheDocument();
  });

  it("dispara onComplete ao concluir a série", () => {
    const onComplete = vi.fn();
    render(<SetLogger currentSet={1} totalSets={4} reps={10} load="80 kg" onComplete={onComplete} />);
    screen.getByRole("button").click();
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("aceita rótulo customizado de conclusão", () => {
    render(<SetLogger currentSet={1} totalSets={4} reps={10} load="80 kg" onComplete={vi.fn()} completeLabel="Registrar série" />);
    expect(screen.getByRole("button", { name: /Registrar série/ })).toBeInTheDocument();
  });
});
