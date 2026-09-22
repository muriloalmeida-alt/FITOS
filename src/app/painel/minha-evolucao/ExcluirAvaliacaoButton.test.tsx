import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExcluirAvaliacaoButton } from "./ExcluirAvaliacaoButton";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

describe("ExcluirAvaliacaoButton (FIT-104)", () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
  });

  it("exclui a avaliação e atualiza a página", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "a1" }) });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<ExcluirAvaliacaoButton assessmentId="a1" />);

    await user.click(screen.getByRole("button", { name: "Excluir" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/minhas-avaliacoes/a1", { method: "DELETE" });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("mostra mensagem de erro e permite nova tentativa quando a resposta falha", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ message: "Avaliação não encontrada." }) });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<ExcluirAvaliacaoButton assessmentId="a1" />);

    await user.click(screen.getByRole("button", { name: "Excluir" }));

    expect(await screen.findByText("Avaliação não encontrada.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Excluir" })).not.toBeDisabled();
  });
});
