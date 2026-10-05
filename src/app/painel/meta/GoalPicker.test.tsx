import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@/shared/ui";
import { GoalPicker } from "./GoalPicker";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
afterEach(() => vi.restoreAllMocks());

describe("Escolher a meta (EPIC-30)", () => {
  it("toca na sugestão, ajusta o valor e o prazo e salva o texto pronto", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response("{}", { status: 201 }));
    render(
      <ToastProvider>
        <GoalPicker
          todayIso="2026-10-05T12:00:00.000Z"
          doneHref="/painel/progresso"
          suggestions={[
            { key: "peso", value: 2, step: 0.5, min: 0.5, unit: "kg", why: "Ritmo saudável" },
            { key: "carga", value: 50, step: 2.5, min: 2.5, unit: "kg", exerciseName: "Agachamento", why: "Seu recorde hoje é 45 kg" },
          ]}
        />
      </ToastProvider>
    );
    expect(screen.getByRole("radio", { name: /Perder 2 kg até janeiro/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: /Agachamento com 50 kg/ }));
    await userEvent.click(screen.getByRole("button", { name: "Aumentar ajustar" }));
    await userEvent.click(screen.getByRole("radio", { name: "abril" }));
    await userEvent.click(screen.getByRole("button", { name: "Salvar meta" }));
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.description).toBe("Agachamento com 52,5 kg até abril");
    expect(body.targetDate).toBe("2027-04-30T00:00:00.000Z");
    expect(push).toHaveBeenCalledWith("/painel/progresso");
  });
});
