import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ComecarTreinoButton } from "./ComecarTreinoButton";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

describe("ComecarTreinoButton (FIT-041)", () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
  });

  it("inicia o treino e atualiza a página", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "sess1" }) });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<ComecarTreinoButton workoutId="w1" />);

    await user.click(screen.getByRole("button", { name: "Começar treino" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/workout-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workoutId: "w1" }),
    });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("mostra mensagem de erro e permite nova tentativa quando a resposta falha", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ message: "Treino não encontrado." }) });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<ComecarTreinoButton workoutId="w1" />);

    await user.click(screen.getByRole("button", { name: "Começar treino" }));

    expect(await screen.findByText("Treino não encontrado.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Começar treino" })).not.toBeDisabled();
  });

  it("mostra mensagem de falha de conexão quando o fetch lança (sem prometer funcionamento offline)", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("network error"));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<ComecarTreinoButton workoutId="w1" />);

    await user.click(screen.getByRole("button", { name: "Começar treino" }));

    expect(await screen.findByText(/Falha de conexão/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Começar treino" })).not.toBeDisabled();
  });
});
