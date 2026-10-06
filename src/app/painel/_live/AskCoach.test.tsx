import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@/shared/ui";
import { AskCoach } from "./AskCoach";

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: "t1" }), { status: 201 }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("Perguntar ao personal no treino (EPIC-39)", () => {
  it("abre um assunto de exercício com o exercício da tela", async () => {
    render(
      <ToastProvider>
        <AskCoach exerciseId="e1" exerciseName="Supino reto" coachName="Joana Lima" />
      </ToastProvider>
    );
    await userEvent.click(screen.getByRole("button", { name: "Perguntar a Joana" }));
    expect(screen.getByRole("dialog", { name: "Pergunta sobre Supino reto" })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Mensagem"), "A pegada está certa?");
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({ category: "EXERCICIO", exerciseId: "e1", body: "A pegada está certa?" });
    expect(await screen.findByText("Enviado para Joana")).toBeInTheDocument();
  });
});
