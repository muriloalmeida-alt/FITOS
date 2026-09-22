import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EncerrarVinculoForm } from "./EncerrarVinculoForm";

const push = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

describe("EncerrarVinculoForm (FIT-106)", () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
  });

  it("envia o motivo informado e navega de volta ao perfil do aluno", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "s1", status: "VINCULO_ENCERRADO" }) });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<EncerrarVinculoForm studentId="s1" />);

    await user.type(screen.getByLabelText("Motivo (opcional)"), "Mudança de cidade");
    await user.click(screen.getByRole("button", { name: "Confirmar encerramento" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/students/s1/encerrar-vinculo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Mudança de cidade" }),
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/painel/alunos/s1"));
    expect(refresh).toHaveBeenCalled();
  });

  it("envia reason null quando o motivo não é preenchido", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "s1" }) });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<EncerrarVinculoForm studentId="s1" />);

    await user.click(screen.getByRole("button", { name: "Confirmar encerramento" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/students/s1/encerrar-vinculo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: null }),
    });
  });

  it("mostra mensagem de erro e permite nova tentativa quando a resposta falha", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ message: "Aluno não encontrado." }) });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<EncerrarVinculoForm studentId="s1" />);

    await user.click(screen.getByRole("button", { name: "Confirmar encerramento" }));

    expect(await screen.findByText("Aluno não encontrado.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar encerramento" })).not.toBeDisabled();
  });
});
