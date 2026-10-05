import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ToastProvider } from "@/shared/ui";

const requirePersonal = vi.fn();
const listStudents = vi.fn();
const listChargesForTenant = vi.fn();
const listActiveRecurrencesForTenant = vi.fn();
const getFinancialSummary = vi.fn();
const countPendingRecurrencesForMonth = vi.fn();
const redirect = vi.fn((_url: string) => {
  throw new Error("NEXT_REDIRECT");
});

const emptySummary = { previstoCents: 0, recebidoCents: 0, pendenteCents: 0, atrasadoCents: 0 };

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
    "@/modules/tenancy/authContext"
  );
  return { ...actual, requirePersonal: (...args: unknown[]) => requirePersonal(...args) };
});

vi.mock("@/modules/students/students", async () => {
  const actual = await vi.importActual<typeof import("@/modules/students/students")>(
    "@/modules/students/students"
  );
  return { ...actual, listStudents: (...args: unknown[]) => listStudents(...args) };
});

vi.mock("@/modules/student-finance/charges", async () => {
  const actual = await vi.importActual<typeof import("@/modules/student-finance/charges")>(
    "@/modules/student-finance/charges"
  );
  return {
    ...actual,
    listChargesForTenant: (...args: unknown[]) => listChargesForTenant(...args),
    listActiveRecurrencesForTenant: (...args: unknown[]) => listActiveRecurrencesForTenant(...args),
    getFinancialSummary: (...args: unknown[]) => getFinancialSummary(...args),
    countPendingRecurrencesForMonth: (...args: unknown[]) => countPendingRecurrencesForMonth(...args),
    ensureCurrentMonthCharges: async () => ({ created: 0 }),
  };
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/modules/identity/auth-client", () => ({
  signOut: vi.fn(),
}));

describe("FinanceiroPage (FIT-148)", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  function mockData() {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "t1" });
    listStudents.mockResolvedValue({ items: [{ id: "s1", displayName: "Ana Costa" }, { id: "s2", displayName: "Bruno Reis" }], total: 2, page: 1, pageSize: 100 });
    getFinancialSummary.mockResolvedValue({ previstoCents: 54000, recebidoCents: 18000, pendenteCents: 18000, atrasadoCents: 18000 });
    countPendingRecurrencesForMonth.mockResolvedValue(2);
    const charge = (id: string, student: { id: string; displayName: string }, status: string, extra: Record<string, unknown> = {}) => ({
      id,
      description: "Mensalidade",
      amountCents: 18000,
      referenceMonth: new Date(Date.UTC(2026, 9, 1)),
      dueDate: new Date(Date.UTC(2026, 9, 10)),
      status,
      cancelReason: null,
      recurrenceId: null,
      student,
      payment: null,
      ...extra,
    });
    listChargesForTenant.mockResolvedValue([
      charge("c1", { id: "s1", displayName: "Ana Costa" }, "PAGO", { payment: { id: "p1", amountCentsPaid: 18000, paidAt: new Date(2026, 9, 3, 12), method: "Pix" }, recurrenceId: "r1" }),
      charge("c2", { id: "s2", displayName: "Bruno Reis" }, "ATRASADO"),
      charge("c3", { id: "s2", displayName: "Bruno Reis" }, "PENDENTE", { description: "Avaliação" }),
    ]);
    listActiveRecurrencesForTenant.mockResolvedValue([
      { id: "r1", description: "Mensalidade", amountCents: 18000, dueDayOfMonth: 10, student: { id: "s1", displayName: "Ana Costa" } },
      { id: "r2", description: "Mensalidade", amountCents: 20000, dueDayOfMonth: 5, student: { id: "s2", displayName: "Bruno Reis" } },
    ]);
  }

  async function renderPage(searchParams: Record<string, string> = {}) {
    const { default: FinanceiroPage } = await import("./page");
    render(<ToastProvider>{await FinanceiroPage({ searchParams: Promise.resolve(searchParams) })}</ToastProvider>);
  }

  it("redireciona para /entrar quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requirePersonal.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));
    const { default: FinanceiroPage } = await import("./page");
    await expect(FinanceiroPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/entrar");
  });

  it("mostra a competência, o resumo, o aviso de controle manual e filtra por status", async () => {
    mockData();
    await renderPage({ mes: "2026-10" });

    expect(screen.getByText("Outubro de 2026")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mês anterior" })).toHaveAttribute("href", "/painel/financeiro?mes=2026-09");
    expect(screen.getByRole("link", { name: "Próximo mês" })).toHaveAttribute("href", "/painel/financeiro?mes=2026-11");
    expect(getFinancialSummary.mock.calls[0]![0]).toEqual({ tenantId: "t1", referenceMonth: new Date(Date.UTC(2026, 9, 1)) });
    expect(screen.getByText(/2 mensalidades recorrentes ainda não lançadas/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gerar todas" })).toBeInTheDocument();

    // Atrasada primeiro; só as abertas têm "Recebi".
    const rows = screen.getAllByRole("listitem");
    expect(within(rows[0]!).getByText("Atrasada")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Recebi de/ })).toHaveLength(2);
    expect(screen.getByText(/pago em 03\/10 · Pix/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Pagas · 1" }));
    expect(screen.queryByRole("button", { name: /^Recebi de/ })).not.toBeInTheDocument();
  });

  it("Recebi abre com o valor preenchido e as formas de pagamento", async () => {
    mockData();
    await renderPage({ mes: "2026-10" });

    fireEvent.click(screen.getAllByRole("button", { name: "Registrar outro valor ou data para Bruno Reis" })[0]!);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("Valor recebido (R$)")).toHaveValue("180,00");
    expect(within(dialog).getByRole("radio", { name: "Outra data" })).toBeInTheDocument();
    expect(within(dialog).getByRole("radio", { name: "Transferência" })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar esta cobrança" }));
    expect(screen.getByRole("dialog", { name: "Cancelar cobrança?" })).toBeInTheDocument();
  });

  it("Recebi registra o valor cheio em um toque e oferece Desfazer; atrasada tem Lembrar no WhatsApp", async () => {
    mockData();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify({}), { status: 200 }));
    await renderPage({ mes: "2026-10" });
    fireEvent.click(screen.getAllByRole("button", { name: "Recebi de Bruno Reis" })[0]!);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/cobrancas\/.+\/recebi$/), expect.objectContaining({ method: "POST" })));
    fireEvent.click(await screen.findByRole("button", { name: "Desfazer" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/desfazer-pagamento$/), expect.anything()));
    const remind = screen.queryAllByRole("link", { name: /^Lembrar/ });
    for (const link of remind) expect(link.getAttribute("href")).toMatch(/^https:\/\/wa\.me\/\?text=/);
    fetchMock.mockRestore();
  });

  it("aba Recorrentes mostra o que já foi lançado no mês e ?nova=1 abre a nova cobrança", async () => {
    mockData();
    await renderPage({ mes: "2026-10", aba: "recorrentes", nova: "1" });

    expect(screen.getByText("Lançada")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gerar outubro de 2026 de Bruno Reis" })).toBeInTheDocument();
    const dialog = screen.getByRole("dialog", { name: "Nova cobrança" });
    expect(within(dialog).getByRole("switch", { name: /Repetir todo mês/ })).toBeChecked();
    expect(within(dialog).getByRole("button", { name: "Criar cobrança" })).toBeDisabled();
  });
});
