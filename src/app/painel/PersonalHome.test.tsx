import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PersonalHome } from "./PersonalHome";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/modules/identity/auth-client", () => ({
  signOut: vi.fn(),
}));

describe("PersonalHome (FIT-060, redesenhado na FIT-120)", () => {
  it("exibe alunos ativos, treinos ativos e o atrasado do mês, com atalhos reais", () => {
    render(
      <PersonalHome
        name="Joana"
        email="joana@example.test"
        tenantName="Espaço de Joana"
        greeting="Bom dia"
        activeStudentsCount={5}
        activeWorkoutsCount={3}
        atrasadoCents={3000}
        attentionItems={[]}
      />
    );

    expect(screen.getByText("Bom dia, Joana.")).toBeInTheDocument();
    expect(screen.getAllByText("5")).toHaveLength(2);
    expect(screen.getAllByText("3")).toHaveLength(2);
    expect(screen.getByText("R$ 30,00")).toBeInTheDocument();

    const novoAluno = screen.getByRole("link", { name: "+ Novo aluno" });
    expect(novoAluno).toHaveAttribute("href", "/painel/alunos/novo");
    const novoTreino = screen.getByRole("link", { name: "+ Novo treino" });
    expect(novoTreino).toHaveAttribute("href", "/painel/treinos/novo");
    const verFinanceiro = screen.getByRole("link", { name: "Ver financeiro" });
    expect(verFinanceiro).toHaveAttribute("href", "/painel/financeiro");

    expect(screen.queryByText(/Comece cadastrando seu primeiro aluno/)).not.toBeInTheDocument();
  });

  it("exibe zero honesto quando não há nada atrasado, alunos ou treinos", () => {
    render(
      <PersonalHome
        name="Joana"
        email="joana@example.test"
        tenantName={null}
        greeting="Boa tarde"
        activeStudentsCount={0}
        activeWorkoutsCount={0}
        atrasadoCents={0}
        attentionItems={[]}
      />
    );

    expect(screen.getByText("R$ 0,00")).toBeInTheDocument();
    expect(screen.getAllByText("0")).toHaveLength(4);
    expect(screen.queryByText("Seu espaço")).not.toBeInTheDocument();
    expect(screen.getByText(/Comece cadastrando seu primeiro aluno/)).toBeInTheDocument();
  });

  it("sem nenhum aluno precisando de atenção, a seção 'Precisa de atenção' nunca aparece", () => {
    render(
      <PersonalHome
        name="Joana"
        email="joana@example.test"
        tenantName={null}
        greeting="Boa noite"
        activeStudentsCount={2}
        activeWorkoutsCount={1}
        atrasadoCents={0}
        attentionItems={[]}
      />
    );

    expect(screen.queryByText("Precisa de atenção")).not.toBeInTheDocument();
  });

  it("com alunos precisando de atenção, exibe cada um como link para o próprio perfil", () => {
    render(
      <PersonalHome
        name="Joana"
        email="joana@example.test"
        tenantName={null}
        greeting="Bom dia"
        activeStudentsCount={2}
        activeWorkoutsCount={1}
        atrasadoCents={32000}
        attentionItems={[
          { studentId: "s1", title: "Diego Santos", description: "Mensalidade vencida · R$ 320,00", icon: "$", tone: "warning" },
          { studentId: "s2", title: "Lucas Pereira", description: "Avaliação há 70 dias", icon: "◎", tone: "neutral" },
        ]}
      />
    );

    expect(screen.getByText("Precisa de atenção")).toBeInTheDocument();
    const diego = screen.getByRole("link", { name: /Diego Santos/ });
    expect(diego).toHaveAttribute("href", "/painel/alunos/s1");
    expect(screen.getByText("Mensalidade vencida · R$ 320,00")).toBeInTheDocument();
    const lucas = screen.getByRole("link", { name: /Lucas Pereira/ });
    expect(lucas).toHaveAttribute("href", "/painel/alunos/s2");
    expect(screen.getByText("Avaliação há 70 dias")).toBeInTheDocument();
  });
});
