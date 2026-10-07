import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { ToastProvider } from "@/shared/ui";
import { FreeWorkoutButton } from "./FreeWorkoutButton";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

describe("FreeWorkoutButton (treino avulso)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    push.mockReset();
  });

  it("pergunta o foco (múltipla escolha) antes de começar e envia o escolhido", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ id: "sess1" }), { status: 201 })));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <ToastProvider>
        <FreeWorkoutButton />
      </ToastProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: /Treino avulso/ }));
    expect(screen.getByRole("dialog", { name: "O que você quer treinar hoje?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Escolha o foco" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Costas" }));
    fireEvent.click(screen.getByRole("button", { name: "Aeróbico" }));
    fireEvent.click(screen.getByRole("button", { name: "Superiores" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Começar treino avulso" }));
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/minhas-sessoes/avulso", expect.objectContaining({ method: "POST", body: JSON.stringify({ focus: ["Superiores", "Aeróbico", "Costas"] }) }));
    expect(push).toHaveBeenCalledWith("/painel/meus-treinos/sessao");
  });
});
