import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@/shared/ui";
import { PARQ_QUESTIONS } from "@/shared/lib/healthForm";
import { HealthFormEditor } from "./HealthFormEditor";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ parqYes: 1 }), { status: 200 }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("ficha de saúde (EPIC-46)", () => {
  it("exige todas as respostas do PAR-Q e salva", async () => {
    render(
      <ToastProvider>
        <HealthFormEditor initial={null} endpoint="/api/ficha-saude" doneHref="/painel" />
      </ToastProvider>
    );
    await userEvent.click(screen.getByRole("radio", { name: /Treino às vezes/ }));
    await userEvent.click(screen.getByRole("button", { name: "Salvar ficha" }));
    expect(screen.getByText("Responda todas as perguntas de sim ou não.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    for (const [index, question] of PARQ_QUESTIONS.entries()) {
      await userEvent.click(screen.getByRole("radiogroup", { name: question }).querySelectorAll("[role=radio]")[index === 0 ? 1 : 0] as HTMLElement);
    }
    await userEvent.click(screen.getByRole("button", { name: "Salvar ficha" }));
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.parq).toEqual([true, false, false, false, false, false, false]);
    expect(body.activity).toBe("IRREGULAR");
    expect(push).toHaveBeenCalledWith("/painel");
  });
});
