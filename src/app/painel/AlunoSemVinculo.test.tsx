import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AlunoSemVinculo } from "./AlunoSemVinculo";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("@/modules/identity/auth-client", () => ({ signOut: vi.fn() }));

describe("AlunoSemVinculo (FIT-151)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    push.mockReset();
  });

  it("entra com o código do convite e volta ao Início", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    render(<AlunoSemVinculo name="Ana Souza" ended />);
    expect(screen.getByRole("heading", { level: 1, name: "Vínculo encerrado" })).toBeInTheDocument();
    const enter = screen.getByRole("button", { name: "Entrar com o convite" });
    expect(enter).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Código ou link do convite"), { target: { value: "abc123" } });
    fireEvent.click(enter);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/painel"));
    expect(fetchMock).toHaveBeenCalledWith("/api/minha-conta/convite", expect.objectContaining({ method: "POST", body: JSON.stringify({ code: "abc123" }) }));
  });

  it("código inválido mostra a mensagem do servidor", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: "CODIGO_INVALIDO", message: "Código inválido ou expirado." }), { status: 400 }));
    render(<AlunoSemVinculo name="Ana" />);
    fireEvent.change(screen.getByLabelText("Código ou link do convite"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar com o convite" }));
    expect(await screen.findByText("Código inválido ou expirado.")).toBeInTheDocument();
  });

  it("treinar por conta própria leva ao onboarding do Livre", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ ok: true, redirectTo: "/onboarding" }), { status: 200 }));
    render(<AlunoSemVinculo name="Ana" />);
    fireEvent.click(screen.getByRole("button", { name: "Treinar por conta própria" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/onboarding"));
  });
});
