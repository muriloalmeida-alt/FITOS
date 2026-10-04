import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));

describe("AtivarContaForm (FIT-165)", () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
  });

  it("senha curta não envia", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { AtivarContaForm } = await import("./AtivarContaForm");
    const user = userEvent.setup();
    render(<AtivarContaForm token="t1" email="a@b.co" />);
    await user.type(screen.getByLabelText("Crie sua senha"), "123");
    await user.click(screen.getByRole("button", { name: "Entrar no FitOS" }));
    expect(await screen.findByText("Use pelo menos 8 caracteres.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ativa e vai direto ao Início", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { AtivarContaForm } = await import("./AtivarContaForm");
    const user = userEvent.setup();
    render(<AtivarContaForm token="t1" email="a@b.co" />);
    await user.type(screen.getByLabelText("Crie sua senha"), "senha-forte-123");
    await user.click(screen.getByRole("button", { name: "Entrar no FitOS" }));
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/painel"));
    expect(fetchMock).toHaveBeenCalledWith("/api/ativar-conta", expect.objectContaining({ body: JSON.stringify({ token: "t1", password: "senha-forte-123" }) }));
  });

  it("mostra o erro do servidor", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "Este link não é válido ou já expirou." }), { status: 400 })));
    const { AtivarContaForm } = await import("./AtivarContaForm");
    const user = userEvent.setup();
    render(<AtivarContaForm token="t1" email="a@b.co" />);
    await user.type(screen.getByLabelText("Crie sua senha"), "senha-forte-123");
    await user.click(screen.getByRole("button", { name: "Entrar no FitOS" }));
    expect(await screen.findByText("Este link não é válido ou já expirou.")).toBeInTheDocument();
  });
});
