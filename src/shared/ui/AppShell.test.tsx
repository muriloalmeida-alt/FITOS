import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppShell, type AppShellNavItem } from "./AppShell";

const items: AppShellNavItem[] = [
  { key: "inicio", label: "Início", href: "/painel" },
  { key: "alunos", label: "Alunos", comingSoon: true },
  { key: "treinos", label: "Treinos", comingSoon: true },
  { key: "financeiro", label: "Financeiro", comingSoon: true },
  { key: "config", label: "Configurações", comingSoon: true },
];

const ALUNO_ITEMS: AppShellNavItem[] = [
  { key: "hoje", label: "Hoje", href: "/painel" },
  { key: "treino", label: "Treino", href: "/painel/treino" },
  { key: "progresso", label: "Progresso", href: "/painel/progresso" },
  { key: "perfil", label: "Perfil", href: "/painel/perfil" },
];

const PERSONAL_ITEMS: AppShellNavItem[] = [
  { key: "inicio", label: "Início", href: "/painel" },
  { key: "alunos", label: "Alunos", href: "/painel/alunos" },
  { key: "treinos", label: "Treinos", href: "/painel/treinos" },
  { key: "exercicios", label: "Exercícios", href: "/painel/exercicios" },
  { key: "financeiro", label: "Financeiro", href: "/painel/financeiro" },
  { key: "config", label: "Configurações", comingSoon: true },
];

describe("AppShell", () => {
  it("renderiza título, conteúdo e o destino ativo real como link navegável", () => {
    render(
      <AppShell title="Início" navItems={items} activeKey="inicio">
        <p>Conteúdo da página</p>
      </AppShell>
    );

    expect(screen.getByRole("heading", { name: "Início" })).toBeInTheDocument();
    expect(screen.getByText("Conteúdo da página")).toBeInTheDocument();

    const activeLinks = screen.getAllByRole("link", { name: "Início" });
    expect(activeLinks.length).toBeGreaterThan(0);
    for (const link of activeLinks) {
      expect(link).toHaveAttribute("href", "/painel");
      expect(link).toHaveAttribute("aria-current", "page");
    }
  });

  it("nunca renderiza um destino 'em breve' como link navegável", () => {
    render(
      <AppShell title="Início" navItems={items} activeKey="inicio">
        <p>Conteúdo</p>
      </AppShell>
    );

    expect(screen.queryAllByRole("link", { name: /Alunos|Treinos|Financeiro|Configurações/ })).toHaveLength(0);
    const disabledLabels = screen.getAllByText("Em breve");
    expect(disabledLabels.length).toBeGreaterThan(0);
  });

  it("agrupa destinos além do 4º sob 'Mais' na navegação compacta, e revela ao clicar", async () => {
    const user = userEvent.setup();
    render(
      <AppShell title="Início" navItems={items} activeKey="inicio">
        <p>Conteúdo</p>
      </AppShell>
    );

    const moreButton = screen.getByRole("button", { name: "Mais" });
    expect(moreButton).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    await user.click(moreButton);

    expect(moreButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("renderiza o slot de trailing (ex.: botão de logout) na barra superior", () => {
    render(
      <AppShell title="Início" navItems={items} activeKey="inicio" trailing={<button type="button">Sair</button>}>
        <p>Conteúdo</p>
      </AppShell>
    );

    expect(screen.getByRole("button", { name: "Sair" })).toBeInTheDocument();
  });

  it("sem overflow (4 destinos reais, ex.: Aluno): mostra os 4 na barra compacta, nenhum botão Mais", () => {
    render(
      <AppShell title="Hoje" navItems={ALUNO_ITEMS} activeKey="hoje">
        <p>Conteúdo</p>
      </AppShell>
    );
    const bottomNav = screen.getAllByRole("navigation", { name: "Navegação principal" })[1] as HTMLElement;

    expect(within(bottomNav).getByRole("link", { name: "Hoje" })).toBeInTheDocument();
    expect(within(bottomNav).getByRole("link", { name: "Perfil" })).toBeInTheDocument();
    expect(within(bottomNav).queryByRole("button", { name: "Mais" })).not.toBeInTheDocument();
  });

  it("com overflow (6 destinos, ex.: Personal): mostra só os 3 primeiros + Mais, nunca 4 reais + um 5º botão", () => {
    render(
      <AppShell title="Início" navItems={PERSONAL_ITEMS} activeKey="inicio">
        <p>Conteúdo</p>
      </AppShell>
    );
    const bottomNav = screen.getAllByRole("navigation", { name: "Navegação principal" })[1] as HTMLElement;

    expect(within(bottomNav).getByRole("link", { name: "Início" })).toBeInTheDocument();
    expect(within(bottomNav).getByRole("link", { name: "Alunos" })).toBeInTheDocument();
    expect(within(bottomNav).getByRole("link", { name: "Treinos" })).toBeInTheDocument();
    expect(within(bottomNav).queryByRole("link", { name: "Exercícios" })).not.toBeInTheDocument();
    expect(within(bottomNav).getByRole("button", { name: "Mais" })).toBeInTheDocument();
  });

  it("renderiza a marca FitOS (BrandLogo) no cabeçalho", () => {
    render(
      <AppShell title="Início" navItems={items} activeKey="inicio">
        <p>Conteúdo</p>
      </AppShell>
    );
    expect(screen.getByRole("img", { name: "FitOS" })).toBeInTheDocument();
  });
});
