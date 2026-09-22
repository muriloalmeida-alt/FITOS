import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ComecarMeuTreinoButton } from "./ComecarMeuTreinoButton";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

describe("ComecarMeuTreinoButton (FIT-103)", () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
  });

  it("inicia o treino e redireciona para a sessão", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "sess1" }) });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<ComecarMeuTreinoButton workoutId="w1" />);

    await user.click(screen.getByRole("button", { name: "Começar treino" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/minhas-sessoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workoutId: "w1" }),
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/painel/meus-treinos/sessao"));
  });

  it("mostra mensagem de erro e permite nova tentativa quando a resposta falha", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ message: "Treino não encontrado." }) });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<ComecarMeuTreinoButton workoutId="w1" />);

    await user.click(screen.getByRole("button", { name: "Começar treino" }));

    expect(await screen.findByText("Treino não encontrado.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Começar treino" })).not.toBeDisabled();
  });

  it("mostra mensagem de falha de conexão quando o fetch lança", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("network error"));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<ComecarMeuTreinoButton workoutId="w1" />);

    await user.click(screen.getByRole("button", { name: "Começar treino" }));

    expect(await screen.findByText(/Falha de conexão/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Começar treino" })).not.toBeDisabled();
  });
});
