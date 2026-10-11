import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@/shared/ui";
import { TrainingPreferences } from "./TrainingPreferences";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
afterEach(() => vi.restoreAllMocks());

function renderPrefs(reminderHour: number | null = null) {
  render(
    <ToastProvider>
      <TrainingPreferences reminderHour={reminderHour} days={[]} planDays={["SEGUNDA", "QUARTA"]} coachFirst="Joana" />
    </ToastProvider>
  );
}

describe("Lembrete e Meus dias (EPIC-31)", () => {
  it("dias começam nos do programa; tocar num dia salva e avisa que o personal fica sabendo", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response("{}", { status: 200 }));
    renderPrefs();
    expect(screen.getByText("seg, qua")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Meus dias/ }));
    expect(screen.getByText("Joana é avisado se você mudar.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Sexta" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/meus-dias", expect.objectContaining({ body: JSON.stringify({ days: ["SEGUNDA", "QUARTA", "SEXTA"] }) }));
    expect(screen.getByText("seg, qua, sex")).toBeInTheDocument();
  });

  it("navegador sem push explica em vez de ligar um lembrete que não chegaria; desligar funciona", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response("{}", { status: 200 }));
    renderPrefs(7);
    expect(screen.getByText("Nos dias de treino, às 7h")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Lembrete de treino/ }));
    await waitFor(() => expect(screen.getByRole("radio", { name: "18h" })).toBeInTheDocument());
    await userEvent.click(screen.getByRole("radio", { name: "18h" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/não recebe notificações/);
    await userEvent.click(screen.getByRole("radio", { name: "Desligado" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/minhas-notificacoes", expect.objectContaining({ body: JSON.stringify({ reminderHour: null }) }));
    expect(screen.getByText("Desligado", { selector: "span" })).toBeInTheDocument();
  });
});
