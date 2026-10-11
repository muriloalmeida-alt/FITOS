import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@/shared/ui";
import { WeighIn } from "./WeighIn";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
afterEach(() => vi.restoreAllMocks());

describe("Pesar na régua (EPIC-30)", () => {
  it("começa no último peso, mostra a diferença e salva", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response("{}", { status: 201 }));
    render(
      <ToastProvider>
        <WeighIn last={{ weightKg: 64.8, bodyFatPercent: null, dateLabel: "3 de agosto" }} allowFat={false} doneHref="/painel/progresso" />
      </ToastProvider>
    );
    const ruler = screen.getByRole("slider", { name: "Peso" });
    expect(ruler).toHaveAttribute("aria-valuenow", "64.8");
    for (let i = 0; i < 5; i += 1) fireEvent.keyDown(ruler, { key: "ArrowLeft" });
    expect(screen.getByText("−0,5 kg desde 3 de agosto")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+ % de gordura" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Salvar 64,3 kg" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/meu-peso", expect.objectContaining({ body: JSON.stringify({ weightKg: 64.3, bodyFatPercent: null }) }));
    expect(push).toHaveBeenCalledWith("/painel/progresso");
  });
});
