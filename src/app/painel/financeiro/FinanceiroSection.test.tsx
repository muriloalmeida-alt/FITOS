import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { FinanceiroSection } from "./FinanceiroSection";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
}));

const originalFetch = global.fetch;

describe("FinanceiroSection (FIT-050)", () => {
  afterEach(() => {
    vi.resetAllMocks();
    global.fetch = originalFetch;
  });

  it("mostra estado vazio quando não há cobranças nem alunos ativos", () => {
    render(<FinanceiroSection students={[]} charges={[]} />);

    expect(screen.getByText("Nenhuma cobrança cadastrada ainda.")).toBeInTheDocument();
    expect(screen.getByText("Nenhum aluno ativo para cobrar ainda.")).toBeInTheDocument();
  });

  it("cadastra cobrança usando o aluno selecionado e atualiza a lista", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "c1" }) }) as unknown as typeof fetch;
    render(<FinanceiroSection students={[{ id: "s1", displayName: "Aluno A" }]} charges={[]} />);

    fireEvent.change(screen.getByLabelText("Aluno"), { target: { value: "s1" } });
    fireEvent.change(screen.getByLabelText("Descrição"), { target: { value: "Mensalidade" } });
    fireEvent.change(screen.getByLabelText("Valor (R$)"), { target: { value: "150" } });
    fireEvent.change(screen.getByLabelText("Competência"), { target: { value: "2026-10" } });
    fireEvent.change(screen.getByLabelText("Vencimento"), { target: { value: "2026-10-05" } });
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar cobrança" }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/students/s1/cobrancas",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("exige aluno selecionado antes de enviar", async () => {
    global.fetch = vi.fn() as unknown as typeof fetch;
    render(<FinanceiroSection students={[{ id: "s1", displayName: "Aluno A" }]} charges={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "Cadastrar cobrança" }));

    expect(await screen.findByText("Selecione um aluno.")).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("cancela cobrança exigindo motivo", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "c1", status: "CANCELADO" }) }) as unknown as typeof fetch;
    render(
      <FinanceiroSection
        students={[]}
        charges={[
          {
            id: "c1",
            description: "Mensalidade",
            amountCents: 15000,
            referenceMonth: "2026-10-01T00:00:00.000Z",
            dueDate: "2026-10-05T00:00:00.000Z",
            status: "PENDENTE",
            cancelReason: null,
            student: { id: "s1", displayName: "Aluno A" },
            payment: null,
          },
        ]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelamento" }));
    expect(await screen.findByText("Informe o motivo do cancelamento.")).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Motivo do cancelamento"), { target: { value: "Aluno saiu" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelamento" }));

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/cobrancas/c1/cancelar",
        expect.objectContaining({ method: "POST" })
      )
    );
  });

  it("registra pagamento exigindo data, valor e forma de pagamento", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "c1", status: "PAGO" }) }) as unknown as typeof fetch;
    render(
      <FinanceiroSection
        students={[]}
        charges={[
          {
            id: "c1",
            description: "Mensalidade",
            amountCents: 15000,
            referenceMonth: "2026-10-01T00:00:00.000Z",
            dueDate: "2026-10-05T00:00:00.000Z",
            status: "PENDENTE",
            cancelReason: null,
            student: { id: "s1", displayName: "Aluno A" },
            payment: null,
          },
        ]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Registrar pagamento" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar pagamento" }));
    expect(await screen.findByText("Informe data, valor recebido e forma de pagamento.")).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Valor recebido (R$)"), { target: { value: "150" } });
    fireEvent.change(screen.getByLabelText("Data do pagamento"), { target: { value: "2026-10-04" } });
    fireEvent.change(screen.getByLabelText("Forma de pagamento"), { target: { value: "PIX" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar pagamento" }));

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/cobrancas/c1/pagamentos",
        expect.objectContaining({ method: "POST" })
      )
    );
  });

  it("mostra data, valor e forma de pagamento para cobrança já paga", () => {
    render(
      <FinanceiroSection
        students={[]}
        charges={[
          {
            id: "c1",
            description: "Mensalidade",
            amountCents: 15000,
            referenceMonth: "2026-10-01T00:00:00.000Z",
            dueDate: "2026-10-05T00:00:00.000Z",
            status: "PAGO",
            cancelReason: null,
            student: { id: "s1", displayName: "Aluno A" },
            payment: { amountCentsPaid: 15000, paidAt: "2026-10-04T00:00:00.000Z", method: "PIX" },
          },
        ]}
      />
    );

    expect(screen.getByText(/Pago em 04\/10\/2026.*R\$ 150,00.*PIX/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Registrar pagamento" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar" })).not.toBeInTheDocument();
  });

  it("exibe 'A vencer' para pendente com vencimento futuro, e o status real para os demais", () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);

    render(
      <FinanceiroSection
        students={[]}
        charges={[
          {
            id: "c1",
            description: "Mensalidade",
            amountCents: 10000,
            referenceMonth: "2026-10-01T00:00:00.000Z",
            dueDate: futureDate.toISOString(),
            status: "PENDENTE",
            cancelReason: null,
            student: { id: "s1", displayName: "Aluno A" },
            payment: null,
          },
          {
            id: "c2",
            description: "Mensalidade",
            amountCents: 10000,
            referenceMonth: "2026-09-01T00:00:00.000Z",
            dueDate: "2026-09-05T00:00:00.000Z",
            status: "CANCELADO",
            cancelReason: "Aluno saiu",
            student: { id: "s1", displayName: "Aluno A" },
            payment: null,
          },
        ]}
      />
    );

    expect(screen.getByText("A vencer")).toBeInTheDocument();
    expect(screen.getByText("Cancelado")).toBeInTheDocument();
    expect(screen.getByText("Motivo: Aluno saiu")).toBeInTheDocument();
  });
});
