import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@/shared/ui";
import { RoutineRows, daySentence } from "./RoutineRows";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
afterEach(() => vi.restoreAllMocks());

function renderRows(reminderHour: number | null = null) {
  render(
    <ToastProvider>
      <ul>
        <RoutineRows reminderHour={reminderHour} days={[]} planDays={["SEGUNDA", "QUARTA"]} coachFirst="Joana" />
      </ul>
    </ToastProvider>
  );
}

describe("Dias de treino e Lembrete no Perfil (EPIC-31, proposta 10)", () => {
  it("resumo em frase: um, dois e vários dias", () => {
    expect(daySentence([])).toBe("Nenhum dia escolhido");
    expect(daySentence(["SABADO"])).toBe("Sábado");
    expect(daySentence(["SABADO", "TERCA", "QUARTA"])).toBe("Terça, quarta e sábado");
  });

  it("dias começam nos do programa; tocar num dia salva e avisa que o personal fica sabendo", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response("{}", { status: 200 }));
    renderRows();
    expect(screen.getByText("Segunda e quarta")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Dias de treino/ }));
    const dialog = screen.getByRole("dialog", { name: "Dias de treino" });
    expect(within(dialog).getByText("Joana é avisado se você mudar.")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Sexta" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/meus-dias", expect.objectContaining({ body: JSON.stringify({ days: ["SEGUNDA", "QUARTA", "SEXTA"] }) }));
    expect(within(dialog).getByRole("button", { name: "Sexta" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(within(dialog).getByRole("button", { name: "Pronto" }));
    expect(screen.getByText("Segunda, quarta e sexta")).toBeInTheDocument();
  });

  it("erro ao salvar volta ao dia anterior", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response("{}", { status: 500 }));
    renderRows();
    await userEvent.click(screen.getByRole("button", { name: /Dias de treino/ }));
    const dialog = screen.getByRole("dialog", { name: "Dias de treino" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Sexta" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/Não foi possível salvar/);
    expect(within(dialog).getByRole("button", { name: "Sexta" })).toHaveAttribute("aria-pressed", "false");
  });

  it("navegador sem push explica em vez de ligar um lembrete que não chegaria; desativar funciona", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response("{}", { status: 200 }));
    renderRows(7);
    expect(screen.getByText("Nos dias de treino, às 7h")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Lembrete de treino/ }));
    const dialog = screen.getByRole("dialog", { name: "Lembrete de treino" });
    await waitFor(() => expect(within(dialog).getByRole("radio", { name: "18h" })).toBeInTheDocument());
    await userEvent.click(within(dialog).getByRole("radio", { name: "18h" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/não recebe notificações/);
    await userEvent.click(within(dialog).getByRole("radio", { name: "Desativado" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/minhas-notificacoes", expect.objectContaining({ body: JSON.stringify({ reminderHour: null }) }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Fechar" }));
    expect(screen.getByText("Desativado")).toBeInTheDocument();
  });
});
