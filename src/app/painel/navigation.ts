import type { AppShellNavItem } from "@/shared/ui";

/// Arquitetura de informação de nível superior por papel, conforme
/// `docs/03-design/UX-ARCHITECTURE.md` ("Arquitetura — personal" /
/// "Arquitetura — aluno"). "Início"/"Hoje" é real desde a FIT-012; "Alunos"
/// passa a ser real na FIT-013 (cadastro e listagem); "Exercícios" passa a
/// ser real na FIT-023 (catálogo unificado); "Treinos" passa a ser real na
/// FIT-030 (modelos de treino — planos semanais chegam na FIT-032). Os
/// demais destinos continuam como rótulo "Em breve" — nenhuma tela ou rota
/// fictícia foi criada para eles.
///
/// `UX-ARCHITECTURE.md` aninha "Exercícios" dentro de "Treinos". "Exercícios"
/// ganhou um item de nível superior próprio na FIT-023 — mesma solução
/// interina já usada para "Alunos" (FIT-013) e "Perfil" do aluno (FIT-016):
/// um destino real não espera o pai conceitual da árvore de informação
/// existir. "Treinos" continua como o item real para modelos/planos.
export const PERSONAL_NAV_ITEMS: AppShellNavItem[] = [
  { key: "inicio", label: "Início", href: "/painel" },
  { key: "alunos", label: "Alunos", href: "/painel/alunos" },
  { key: "exercicios", label: "Exercícios", href: "/painel/exercicios" },
  { key: "treinos", label: "Treinos", href: "/painel/treinos" },
  { key: "financeiro", label: "Financeiro", comingSoon: true },
  { key: "config", label: "Configurações", comingSoon: true },
];

/// "Perfil" passa a ser real na FIT-016 (nome, e-mail, logout). Treino e
/// Progresso continuam "Em breve" — o FitOS não promete treino, carga,
/// evolução, avaliação, agenda ou mensagens nesta Sprint.
export const ALUNO_NAV_ITEMS: AppShellNavItem[] = [
  { key: "hoje", label: "Hoje", href: "/painel" },
  { key: "treino", label: "Treino", comingSoon: true },
  { key: "progresso", label: "Progresso", comingSoon: true },
  { key: "perfil", label: "Perfil", href: "/painel/perfil" },
];
