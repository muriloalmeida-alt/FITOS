import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkoutComment } from "./WorkoutComment";

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: "t9" }), { status: 201 }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("comentário no resumo do treino (EPIC-42)", () => {
  it("envia para o personal e mostra o link da conversa", async () => {
    render(<WorkoutComment sessionId="s1" coachName="Joana Lima" />);
    expect(screen.queryByRole("button", { name: "Enviar para Joana" })).toBeNull();
    await userEvent.type(screen.getByLabelText("Quer contar algo para Joana?"), "Pesou hoje");
    await userEvent.click(screen.getByRole("button", { name: "Enviar para Joana" }));
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({ sessionId: "s1", body: "Pesou hoje" });
    expect(await screen.findByRole("link", { name: "Ver conversa →" })).toHaveAttribute("href", "/painel/mensagens/t9");
  });
});
