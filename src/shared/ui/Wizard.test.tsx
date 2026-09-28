import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { WizardProgress, useUnsavedChangesGuard } from "./Wizard";

describe("WizardProgress (FIT-126)", () => {
  it("mostra o passo atual e o total, e a barra reflete o progresso", () => {
    render(<WizardProgress step={2} totalSteps={4} />);

    expect(screen.getByText("Passo 2 de 4")).toBeInTheDocument();
    const track = screen.getByRole("progressbar");
    expect(track).toHaveAttribute("aria-valuenow", "2");
    expect(track).toHaveAttribute("aria-valuemax", "4");
  });
});

describe("useUnsavedChangesGuard (FIT-126)", () => {
  it("registra o listener de beforeunload quando há dado não salvo e a submissão não está em andamento", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    renderHook(() => useUnsavedChangesGuard(true, false));

    expect(addSpy).toHaveBeenCalledWith("beforeunload", expect.any(Function));
    addSpy.mockRestore();
  });

  it("nunca registra o listener sem dado preenchido", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    renderHook(() => useUnsavedChangesGuard(false, false));

    expect(addSpy).not.toHaveBeenCalledWith("beforeunload", expect.any(Function));
    addSpy.mockRestore();
  });

  it("nunca registra o listener durante a submissão, mesmo com dado preenchido", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    renderHook(() => useUnsavedChangesGuard(true, true));

    expect(addSpy).not.toHaveBeenCalledWith("beforeunload", expect.any(Function));
    addSpy.mockRestore();
  });
});
