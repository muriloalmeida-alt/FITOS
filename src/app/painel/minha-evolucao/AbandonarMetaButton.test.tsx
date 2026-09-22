import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AbandonarMetaButton } from "./AbandonarMetaButton";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

describe("AbandonarMetaButton (FIT-104)", () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
  });

  it("abandona a meta e atualiza a página", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "g1", status: "ABANDONADA" }) });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<AbandonarMetaButton goalId="g1" />);

    await user.click(screen.getByRole("button", { name: "Abandonar" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/minhas-metas/g1/abandonar", { method: "POST" });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("mostra mensagem de erro e permite nova tentativa quando a resposta falha", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ message: "Meta não encontrada." }) });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<AbandonarMetaButton goalId="g1" />);

    await user.click(screen.getByRole("button", { name: "Abandonar" }));

    expect(await screen.findByText("Meta não encontrada.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abandonar" })).not.toBeDisabled();
  });
});
