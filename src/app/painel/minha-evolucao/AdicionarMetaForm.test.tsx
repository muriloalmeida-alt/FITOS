import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdicionarMetaForm } from "./AdicionarMetaForm";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

describe("AdicionarMetaForm (FIT-104)", () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
  });

  it("envia a descrição e a data-alvo e atualiza a página", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "g1" }) });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<AdicionarMetaForm />);

    await user.type(screen.getByLabelText("Nova meta"), "Perder 5kg");
    await user.type(screen.getByLabelText("Data-alvo (opcional)"), "2026-12-31");
    await user.click(screen.getByRole("button", { name: "Adicionar meta" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/minhas-metas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: "Perder 5kg", targetDate: "2026-12-31" }),
    });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("envia targetDate null quando a data-alvo não é preenchida", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "g1" }) });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<AdicionarMetaForm />);

    await user.type(screen.getByLabelText("Nova meta"), "Correr 5km");
    await user.click(screen.getByRole("button", { name: "Adicionar meta" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/minhas-metas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: "Correr 5km", targetDate: null }),
    });
  });

  it("mostra mensagem de erro quando a resposta falha", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ message: "A meta precisa de uma descrição." }) });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<AdicionarMetaForm />);

    await user.type(screen.getByLabelText("Nova meta"), "x");
    await user.click(screen.getByRole("button", { name: "Adicionar meta" }));

    expect(await screen.findByText("A meta precisa de uma descrição.")).toBeInTheDocument();
  });
});
