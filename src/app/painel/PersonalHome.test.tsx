import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@/shared/ui/Toast";
import { PersonalHome } from "./PersonalHome";
import type { PersonalFeedItem } from "@/modules/students/personalFeed";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh }), usePathname: () => "/painel" }));
vi.mock("@/modules/identity/auth-client", () => ({ signOut: vi.fn() }));
afterEach(() => vi.restoreAllMocks());

const stats = { activeStudents: 8, studentLimit: 15, weekCompletion: 62, receivedCents: 0, overdueCount: 1 };
const items: PersonalFeedItem[] = [
  { kind: "cobranca_atrasada", studentId: "s3", studentName: "Bruno Martins", description: "Cobrança atrasada · R$ 180,00", actionLabel: "Registrar pagamento", href: "/painel/alunos/s3?acao=receber", tone: "error", at: null, amountCents: 18000, chargeIds: ["c1"] },
  { kind: "sem_programa", studentId: "s1", studentName: "Ana Souza", description: "Sem programa de treino", actionLabel: "Dar programa", href: "/painel/treinos?aluno=s1", tone: "warn", at: null },
];

function renderHome(feed = { items, total: 2 }) {
  render(
    <ToastProvider>
      <PersonalHome name="Joana Lima" greeting="Bom dia" dateLabel="Domingo, 4 de outubro" banner={{ tone: "ok", text: "Pro · 7 vagas livres", cta: "Assinatura" }} stats={stats} feed={feed} isNewSpace={false} />
    </ToastProvider>
  );
}

describe("Início do personal em fila (EPIC-29)", () => {
  it("uma decisão por vez: Recebi resolve no lugar, com Desfazer, e passa para a próxima", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response("{}", { status: 200 }));
    renderHome();
    expect(screen.getByRole("heading", { level: 1, name: "Bom dia, Joana." })).toBeInTheDocument();
    expect(screen.getByText("0 de 2")).toBeInTheDocument();
    expect(screen.getByText("Bruno pagou R$ 180,00?".replace(" ", " "))).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Lembrar" }).getAttribute("href")).toMatch(/^https:\/\/wa\.me\/\?text=/);
    await userEvent.click(screen.getByRole("button", { name: "Recebi" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/cobrancas/c1/recebi", expect.objectContaining({ method: "POST" }));
    expect(await screen.findByText("Ana está sem programa.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dar programa" })).toHaveAttribute("href", "/painel/treinos?aluno=s1");
    await userEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/cobrancas/c1/desfazer-pagamento", expect.anything()));
    await userEvent.click(screen.getByRole("button", { name: "Depois" }));
    expect(screen.getByText("Tudo em dia.")).toBeInTheDocument();
  });
});
