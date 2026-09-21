import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RecorrenciasSection } from "./RecorrenciasSection";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
}));

const originalFetch = global.fetch;

describe("RecorrenciasSection (FIT-052)", () => {
  afterEach(() => {
    vi.resetAllMocks();
    global.fetch = originalFetch;
  });

  it("mostra estado vazio quando não há recorrências nem alunos ativos", () => {
    render(<RecorrenciasSection students={[]} recurrences={[]} />);

    expect(screen.getByText("Nenhuma cobrança recorrente ativa ainda.")).toBeInTheDocument();
    expect(screen.getByText("Nenhum aluno ativo para cobrar ainda.")).toBeInTheDocument();
  });

  it("cadastra recorrência usando o aluno selecionado", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "r1" }) }) as unknown as typeof fetch;
    render(<RecorrenciasSection students={[{ id: "s1", displayName: "Aluno A" }]} recurrences={[]} />);

    fireEvent.change(screen.getByLabelText("Aluno"), { target: { value: "s1" } });
    fireEvent.change(screen.getByLabelText("Descrição"), { target: { value: "Mensalidade" } });
    fireEvent.change(screen.getByLabelText("Valor (R$)"), { target: { value: "150" } });
    fireEvent.change(screen.getByLabelText("Dia de vencimento (1-28)"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar recorrência" }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(global.fetch).toHaveBeenCalledWith("/api/students/s1/recorrencias", expect.objectContaining({ method: "POST" }));
  });

  it("exige aluno selecionado antes de enviar", async () => {
    global.fetch = vi.fn() as unknown as typeof fetch;
    render(<RecorrenciasSection students={[{ id: "s1", displayName: "Aluno A" }]} recurrences={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "Cadastrar recorrência" }));

    expect(await screen.findByText("Selecione um aluno.")).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("gera a cobrança do mês para a recorrência", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "c1" }) }) as unknown as typeof fetch;
    render(
      <RecorrenciasSection
        students={[]}
        recurrences={[{ id: "r1", description: "Mensalidade", amountCents: 15000, dueDayOfMonth: 5, student: { id: "s1", displayName: "Aluno A" } }]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Gerar cobrança do mês" }));

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith("/api/recorrencias/r1/gerar", expect.objectContaining({ method: "POST" }))
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("encerra a recorrência", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "r1", status: "ENCERRADA" }) }) as unknown as typeof fetch;
    render(
      <RecorrenciasSection
        students={[]}
        recurrences={[{ id: "r1", description: "Mensalidade", amountCents: 15000, dueDayOfMonth: 5, student: { id: "s1", displayName: "Aluno A" } }]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Encerrar" }));

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith("/api/recorrencias/r1/encerrar", expect.objectContaining({ method: "POST" }))
    );
  });
});
