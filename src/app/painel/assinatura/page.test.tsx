import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ToastProvider } from "@/shared/ui";

const requireSubscriber = vi.fn();
const getSubscriptionForTenant = vi.fn();
const listActivePlansForAudience = vi.fn();
const countStudents = vi.fn();
const findProfile = vi.fn();
const redirect = vi.fn((_url: string) => {
  throw new Error("NEXT_REDIRECT");
});

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requireSubscriber: (...args: unknown[]) => requireSubscriber(...args) };
});
vi.mock("@/modules/billing/subscriptions", () => ({ getSubscriptionForTenant: (...args: unknown[]) => getSubscriptionForTenant(...args) }));
vi.mock("@/modules/billing/plans", () => ({ listActivePlansForAudience: (...args: unknown[]) => listActivePlansForAudience(...args) }));
vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    student: { count: (...args: unknown[]) => countStudents(...args) },
    personalProfile: { findUnique: (...args: unknown[]) => findProfile(...args) },
  },
}));
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirect(url), useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/modules/identity/auth-client", () => ({ signOut: vi.fn() }));

const plan = (id: string, name: string, priceCents: number, studentLimit: number | null) => ({ id, name, description: null, priceCents, billingCycle: "MENSAL", studentLimit, trialDays: 30 });
const starter = plan("p1", "Starter", 4990, 5);
const pro = plan("p2", "Pro", 8990, 20);

function asPersonal(subscription: Record<string, unknown> | null, activeStudents = 8) {
  requireSubscriber.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "t1", tenantType: "PERSONAL" });
  listActivePlansForAudience.mockResolvedValue([starter, pro]);
  countStudents.mockResolvedValue(activeStudents);
  findProfile.mockResolvedValue({ phone: "11987654321" });
  getSubscriptionForTenant.mockResolvedValue(subscription);
}

const base = { planId: "p2", plan: pro, status: "ATIVA", trialEndsAt: null, canceledAt: null, createdAt: new Date(2026, 0, 10), creditCardLast4: "4242", creditCardBrand: "VISA" };

async function renderPage() {
  const { default: AssinaturaPage } = await import("./page");
  render(<ToastProvider>{await AssinaturaPage()}</ToastProvider>);
}

describe("AssinaturaPage (FIT-150)", () => {
  afterEach(() => vi.resetAllMocks());

  it("mostra teste grátis, próxima cobrança, uso de alunos e bloqueia plano menor que o uso", async () => {
    asPersonal({ ...base, trialEndsAt: new Date(Date.now() + 12 * 86_400_000) });
    await renderPage();

    expect(screen.getByText("Teste grátis")).toBeInTheDocument();
    expect(screen.getByText(/12 dias restantes · termina em/)).toBeInTheDocument();
    expect(screen.getByText(/Próxima cobrança: .* · R\$\s89,90/)).toBeInTheDocument();
    expect(screen.getByText("8 de 20 alunos ativos")).toBeInTheDocument();
    expect(screen.getByText("Você tem 8 alunos ativos; este plano permite até 5.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Escolher Starter" })).toBeDisabled();
    expect(screen.getByText("VISA •••• 4242")).toBeInTheDocument();
  });

  it("cartão em sheet sem pedir o celular de novo; cancelar exige motivo", async () => {
    asPersonal(base, 3);
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Atualizar" }));
    const cardSheet = screen.getByRole("dialog", { name: "Atualizar cartão" });
    expect(within(cardSheet).getByLabelText("Número do cartão")).toBeInTheDocument();
    expect(within(cardSheet).queryByLabelText("Celular")).not.toBeInTheDocument();
    fireEvent.click(within(cardSheet).getByRole("button", { name: "Agora não" }));

    fireEvent.click(screen.getByRole("button", { name: "Cancelar assinatura" }));
    const cancel = screen.getByRole("dialog", { name: "Cancelar assinatura?" });
    const confirm = within(cancel).getByRole("button", { name: "Cancelar assinatura" });
    expect(confirm).toBeDisabled();
    fireEvent.click(within(cancel).getByRole("radio", { name: "Está caro" }));
    expect(confirm).toBeEnabled();
  });

  it("pagamento pendente pede para atualizar o cartão", async () => {
    asPersonal({ ...base, status: "INADIMPLENTE" }, 3);
    await renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent("Atualize o cartão");
  });

  it("cancelada mostra 'Assinar de novo' e não oferece cancelar (BK-18)", async () => {
    asPersonal({ ...base, status: "CANCELADA", canceledAt: new Date(2026, 9, 1, 12) }, 3);
    await renderPage();

    expect(screen.getByText(/Cancelada em .*Seus alunos, treinos e histórico continuam aqui/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar assinatura" })).not.toBeInTheDocument();
    expect(screen.queryByText("Pagamento")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Assinar de novo/ }));
    expect(screen.getByRole("dialog", { name: "Assinar Pro" })).toHaveTextContent("O teste grátis não se repete");
  });

  it("sem sessão vai para /entrar", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requireSubscriber.mockRejectedValue(new AuthError("UNAUTHENTICATED", "x"));
    const { default: AssinaturaPage } = await import("./page");
    await expect(AssinaturaPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/entrar");
  });
});
