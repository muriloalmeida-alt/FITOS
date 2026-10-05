import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@/shared/ui";

const requirePersonal = vi.fn();
const listStudentRoster = vi.fn();
const getSubscriptionForTenant = vi.fn();
const redirect = vi.fn((_url: string) => {
  throw new Error("NEXT_REDIRECT");
});

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requirePersonal: (...args: unknown[]) => requirePersonal(...args) };
});
vi.mock("@/modules/students/roster", () => ({ listStudentRoster: (...args: unknown[]) => listStudentRoster(...args) }));
vi.mock("@/modules/billing/subscriptions", () => ({ getSubscriptionForTenant: (...args: unknown[]) => getSubscriptionForTenant(...args) }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/painel/alunos",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/modules/identity/auth-client", () => ({ signOut: vi.fn() }));

const row = (over: Record<string, unknown>) => ({
  id: "s1", displayName: "Ana Costa", email: "ana@x.com", status: "ATIVO", accessStatus: "CONTA_ATIVA", activePlanName: "Hipertrofia", planWeek: 3, planWeeks: 8,
  weekDone: 1, weekTarget: 2, hasOverdueCharge: false, lastSessionAt: null, needsAttention: false, createdAt: new Date(), ...over,
});

describe("Alunos (FIT-144)", () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
  });

  it("mostra vagas do plano, filtros com contagem e cada aluno com status e semana", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "t1" });
    getSubscriptionForTenant.mockResolvedValue({ plan: { name: "Personal 50", studentLimit: 50 } });
    listStudentRoster.mockResolvedValue({
      rows: [row({}), row({ id: "s2", displayName: "Pedro Lima", activePlanName: null, accessStatus: "CONVITE_EXPIRADO", weekTarget: null, needsAttention: true })],
      total: 2,
      counts: { ativos: 42, atencao: 2, convites: 1, inativos: 3, todos: 45 },
    });
    const { default: Page } = await import("./page");
    render(<ToastProvider>{await Page({ searchParams: Promise.resolve({ filtro: "atencao" }) })}</ToastProvider>);

    expect(screen.getByRole("heading", { name: "42 alunos ativos" })).toBeInTheDocument();
    expect(screen.getByText("Personal 50 · 8 vagas livres")).toBeInTheDocument();
    expect(listStudentRoster).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "t1", filter: "atencao" }));
    expect(screen.getByRole("link", { name: "Precisam de você · 2" })).toHaveAttribute("aria-current", "page");
    const list = screen.getByRole("list", { name: "Lista de alunos" });
    expect(within(list).getByRole("link", { name: /Ana Costa/ })).toHaveAttribute("href", "/painel/alunos/s1");
    expect(within(list).getByText(/Hipertrofia · semana 3 de 8/)).toBeInTheDocument();
    expect(within(list).getByRole("progressbar", { name: "Semana de Ana Costa" })).toHaveAttribute("aria-valuenow", "50");
    expect(within(list).getByText("Convite expirado")).toBeInTheDocument();
  });

  it("convidar cria o aluno, gera o convite e mostra o link com as próximas ações", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (url: string) =>
      url === "/api/students" ? new Response(JSON.stringify({ id: "novo" }), { status: 201 }) : new Response(JSON.stringify({ link: "https://fitos.app/ativar-conta?token=abc" }), { status: 201 })
    );
    vi.stubGlobal("fetch", fetchMock);
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "t1" });
    getSubscriptionForTenant.mockResolvedValue(null);
    listStudentRoster.mockResolvedValue({ rows: [], total: 0, counts: { ativos: 0, atencao: 0, convites: 0, inativos: 0, todos: 0 } });
    const { default: Page } = await import("./page");
    render(<ToastProvider>{await Page()}</ToastProvider>);

    await user.click(screen.getByRole("button", { name: /Convidar ou cadastrar/ }));
    const sheet = screen.getByRole("dialog", { name: "Novo aluno" });
    await user.type(within(sheet).getByLabelText("Nome completo"), "Pedro Lima");
    await user.type(within(sheet).getByLabelText("E-mail"), "pedro@email.com");
    await user.click(within(sheet).getByRole("button", { name: "Cadastrar e gerar convite" }));

    const ready = await screen.findByRole("dialog", { name: "Convite pronto" });
    expect(within(ready).getByRole("textbox", { name: "Link de ativação" })).toHaveValue("https://fitos.app/ativar-conta?token=abc");
    expect(within(ready).getByRole("link", { name: "Atribuir programa" })).toHaveAttribute("href", "/painel/alunos/novo?atribuir=1");
    expect(fetchMock).toHaveBeenCalledWith("/api/students", expect.objectContaining({ body: JSON.stringify({ name: "Pedro Lima", email: "pedro@email.com" }) }));
  });

  it("limite do plano mostra o erro com o caminho para os planos", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "LIMITE_DE_ALUNOS_ATINGIDO", message: "Você atingiu o limite de alunos ativos do seu plano." }), { status: 400 })));
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "t1" });
    getSubscriptionForTenant.mockResolvedValue(null);
    listStudentRoster.mockResolvedValue({ rows: [], total: 0, counts: { ativos: 20, atencao: 0, convites: 0, inativos: 0, todos: 20 } });
    const { default: Page } = await import("./page");
    render(<ToastProvider>{await Page({ searchParams: Promise.resolve({ novo: "1" }) })}</ToastProvider>);
    const sheet = screen.getByRole("dialog", { name: "Novo aluno" });
    await user.type(within(sheet).getByLabelText("Nome completo"), "X");
    await user.type(within(sheet).getByLabelText("E-mail"), "x@x.com");
    await user.click(within(sheet).getByRole("button", { name: "Cadastrar e gerar convite" }));
    expect(await within(sheet).findByRole("alert")).toHaveTextContent("Você atingiu o limite");
    expect(within(sheet).getByRole("link", { name: "Ver planos" })).toHaveAttribute("href", "/painel/assinatura");
  });
});
