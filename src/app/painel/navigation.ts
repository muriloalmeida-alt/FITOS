import type { AppShellNavItem } from "@/shared/ui";

/// Arquitetura de informação de nível superior por papel, conforme
/// `docs/03-design/UX-ARCHITECTURE.md` ("Arquitetura — personal" /
/// "Arquitetura — aluno"). Apenas o destino "Início"/"Hoje" é real nesta
/// História (FIT-012); os demais existem apenas como rótulo "Em breve" —
/// nenhuma tela ou rota fictícia foi criada para eles.
export const PERSONAL_NAV_ITEMS: AppShellNavItem[] = [
  { key: "inicio", label: "Início", href: "/painel" },
  { key: "alunos", label: "Alunos", comingSoon: true },
  { key: "treinos", label: "Treinos", comingSoon: true },
  { key: "financeiro", label: "Financeiro", comingSoon: true },
  { key: "config", label: "Configurações", comingSoon: true },
];

export const ALUNO_NAV_ITEMS: AppShellNavItem[] = [
  { key: "hoje", label: "Hoje", href: "/painel" },
  { key: "treino", label: "Treino", comingSoon: true },
  { key: "progresso", label: "Progresso", comingSoon: true },
  { key: "perfil", label: "Perfil", comingSoon: true },
];
