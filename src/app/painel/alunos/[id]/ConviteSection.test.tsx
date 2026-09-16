import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConviteSection } from "./ConviteSection";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

describe("ConviteSection", () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
  });

  it("NAO_CONVIDADO: mostra apenas o botão de gerar convite", () => {
    render(<ConviteSection studentId="s1" accessStatus="NAO_CONVIDADO" diasRestantes={null} />);

    expect(screen.getByText("Não convidado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gerar convite" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar convite" })).not.toBeInTheDocument();
  });

  it("gera o convite e mostra o link com o botão de copiar", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ link: "https://fitos.test/ativar-conta?token=abc" }) });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    const user = userEvent.setup();
    render(<ConviteSection studentId="s1" accessStatus="NAO_CONVIDADO" diasRestantes={null} />);

    await user.click(screen.getByRole("button", { name: "Gerar convite" }));

    expect(await screen.findByLabelText("Link de ativação")).toHaveValue("https://fitos.test/ativar-conta?token=abc");
    expect(fetchMock).toHaveBeenCalledWith("/api/students/s1/convite", { method: "POST" });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("CONVITE_PENDENTE: mostra validade, botão de cancelar e de gerar novo convite", () => {
    render(<ConviteSection studentId="s1" accessStatus="CONVITE_PENDENTE" diasRestantes={5} />);

    expect(screen.getByText(/expira em 5 dia\(s\)/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar convite" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gerar novo convite" })).toBeInTheDocument();
  });

  it("cancela o convite", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<ConviteSection studentId="s1" accessStatus="CONVITE_PENDENTE" diasRestantes={5} />);

    await user.click(screen.getByRole("button", { name: "Cancelar convite" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/students/s1/convite", { method: "DELETE" });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("CONTA_ATIVA: não mostra nenhum botão de ação", () => {
    render(<ConviteSection studentId="s1" accessStatus="CONTA_ATIVA" diasRestantes={null} />);

    expect(screen.getByText("Conta ativa")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("mostra o erro do servidor quando gerar o convite falha", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "ALUNO_INATIVO", message: "Não é possível convidar um aluno inativo." }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<ConviteSection studentId="s1" accessStatus="NAO_CONVIDADO" diasRestantes={null} />);

    await user.click(screen.getByRole("button", { name: "Gerar convite" }));

    expect(await screen.findByText("Não é possível convidar um aluno inativo.")).toBeInTheDocument();
  });
});
