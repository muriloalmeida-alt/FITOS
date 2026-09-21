import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PersonalHome } from "./PersonalHome";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/modules/identity/auth-client", () => ({
  signOut: vi.fn(),
}));

describe("PersonalHome (FIT-060)", () => {
  it("exibe alunos ativos, treinos ativos e o atrasado do mês, com atalhos reais", () => {
    render(
      <PersonalHome
        name="Joana"
        email="joana@example.test"
        tenantName="Espaço de Joana"
        activeStudentsCount={5}
        activeWorkoutsCount={3}
        atrasadoCents={3000}
      />
    );

    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
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
        activeStudentsCount={0}
        activeWorkoutsCount={0}
        atrasadoCents={0}
      />
    );

    expect(screen.getByText("R$ 0,00")).toBeInTheDocument();
    expect(screen.getAllByText("0")).toHaveLength(2);
    expect(screen.queryByText("Seu espaço")).not.toBeInTheDocument();
    expect(screen.getByText(/Comece cadastrando seu primeiro aluno/)).toBeInTheDocument();
  });
});
