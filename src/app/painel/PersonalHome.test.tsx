import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PersonalHome } from "./PersonalHome";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/modules/identity/auth-client", () => ({
  signOut: vi.fn(),
}));

const stats = { activeStudents: 8, studentLimit: 15, weekCompletion: 62, receivedCents: 0, overdueCount: 0 };

describe("PersonalHome (FIT-143)", () => {
  it("cada linha do feed termina numa ação, e o acesso rápido leva às três criações", () => {
    render(
      <PersonalHome
        name="Joana Lima"
        greeting="Bom dia"
        dateLabel="Domingo, 4 de outubro"
        banner={{ tone: "ok", text: "Pro · 7 vagas livres", cta: "Assinatura" }}
        stats={stats}
        feed={{
          items: [
            { kind: "sem_programa", studentId: "s1", studentName: "Ana Souza", description: "Sem programa de treino", actionLabel: "Atribuir programa", href: "/painel/alunos/s1?atribuir=1", tone: "warn", at: null },
            { kind: "treino_concluido", studentId: "s2", studentName: "Bruno Reis", description: "Concluiu Treino A · 48 min · esforço puxado", actionLabel: "Ver evolução", href: "/painel/alunos/s2", tone: "ok", at: null },
          ],
          total: 12,
        }}
        isNewSpace={false}
      />
    );

    expect(screen.getByRole("heading", { level: 1, name: "Bom dia, Joana." })).toBeInTheDocument();
    expect(screen.getByText("Domingo, 4 de outubro")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Pro · 7 vagas livres/ })).toHaveAttribute("href", "/painel/assinatura");
    expect(screen.getByText("62%")).toBeInTheDocument();
    expect(screen.getByText("recebido no mês")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Atribuir programa →" })).toHaveAttribute("href", "/painel/alunos/s1?atribuir=1");
    expect(screen.getByRole("link", { name: "Ver evolução →" })).toHaveAttribute("href", "/painel/alunos/s2");
    expect(screen.getByRole("link", { name: "Ver alunos que precisam de você" })).toHaveAttribute("href", "/painel/alunos?filtro=atencao");
    expect(screen.getByRole("link", { name: "Convidar aluno" })).toHaveAttribute("href", "/painel/alunos?novo=1");
    expect(screen.getByRole("link", { name: "Montar treino" })).toHaveAttribute("href", "/painel/treinos/novo");
    expect(screen.getByRole("link", { name: "Nova cobrança" })).toHaveAttribute("href", "/painel/financeiro?nova=1");
  });

  it("feed vazio diz que está tudo em dia, sem indicador inventado", () => {
    render(<PersonalHome name="Joana" greeting="Boa noite" banner={null} stats={{ ...stats, studentLimit: null, weekCompletion: null }} feed={{ items: [], total: 0 }} isNewSpace={false} />);

    expect(screen.getByText("Tudo em dia. Nada precisa de você agora.")).toBeInTheDocument();
    expect(screen.getByText("alunos ativos")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Ver alunos que precisam/ })).not.toBeInTheDocument();
  });
});
