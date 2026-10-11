import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@/shared/ui";
import { AssessmentRuler } from "./AssessmentRuler";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
afterEach(() => vi.restoreAllMocks());

describe("Avaliação na régua (EPIC-29)", () => {
  it("começa no último peso, ajusta pela régua e envia só o que foi ligado", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response("{}", { status: 201 }));
    render(
      <ToastProvider>
        <AssessmentRuler studentId="s1" firstName="Pedro" last={{ dateLabel: "1 de setembro", weightKg: 80, bodyFatPercent: 18, waistCm: 90, hipCm: null }} />
      </ToastProvider>
    );
    const weight = screen.getByRole("slider", { name: "Peso" });
    expect(weight).toHaveAttribute("aria-valuenow", "80");
    fireEvent.keyDown(weight, { key: "ArrowLeft" });
    fireEvent.keyDown(weight, { key: "ArrowLeft" });
    expect(weight).toHaveAttribute("aria-valuenow", "79.8");
    expect(screen.getByText("−0,2 kg desde a última")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "+ Cintura" }));
    expect(screen.getByRole("slider", { name: "Cintura" })).toHaveAttribute("aria-valuenow", "90");
    await userEvent.click(screen.getByRole("button", { name: "Salvar avaliação" }));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/students/s1/avaliacoes",
      expect.objectContaining({ body: JSON.stringify({ weightKg: 79.8, bodyFatPercent: null, measurements: [{ type: "CINTURA", valueCm: 90 }] }) })
    );
    expect(push).toHaveBeenCalledWith("/painel/alunos/s1");
  });
});
