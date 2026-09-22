import type { AppShellNavItem } from "@/shared/ui";

/// Arquitetura de informação de nível superior por papel, conforme
/// `docs/03-design/UX-ARCHITECTURE.md` ("Arquitetura — personal" /
/// "Arquitetura — aluno"). "Início"/"Hoje" é real desde a FIT-012; "Alunos"
/// passa a ser real na FIT-013 (cadastro e listagem); "Exercícios" passa a
/// ser real na FIT-023 (catálogo unificado); "Treinos" passa a ser real na
/// FIT-030 (modelos de treino — planos semanais chegam na FIT-032);
/// "Financeiro" passa a ser real na FIT-050 (cadastrar cobrança). Os
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
  { key: "financeiro", label: "Financeiro", href: "/painel/financeiro" },
  { key: "config", label: "Configurações", comingSoon: true },
];

/// "Perfil" passa a ser real na FIT-016 (nome, e-mail, logout); "Treino"
/// passa a ser real na FIT-033 (visão somente leitura do plano atribuído);
/// "Progresso" passa a ser real na FIT-042 (própria evolução, somente
/// leitura). Agenda e Mensagens continuam fora do MVP.
export const ALUNO_NAV_ITEMS: AppShellNavItem[] = [
  { key: "hoje", label: "Hoje", href: "/painel" },
  { key: "treino", label: "Treino", href: "/painel/treino" },
  { key: "progresso", label: "Progresso", href: "/painel/progresso" },
  { key: "perfil", label: "Perfil", href: "/painel/perfil" },
];

/// Navegação do workspace individual do FitOS Livre (FIT-100/FIT-101),
/// mesma arquitetura de `04_FASE_2_2_FITOS_LIVRE.md` do pacote pós-MVP:
/// "Hoje, Treinos, Progresso, Perfil". Só "Hoje" é real nesta História —
/// "Treinos" (builder, FIT-102), "Progresso" (FIT-104) e "Perfil" ainda
/// não têm nenhuma rota, mesma solução interina de `comingSoon` já usada
/// acima para o personal.
export const INDIVIDUAL_NAV_ITEMS: AppShellNavItem[] = [
  { key: "hoje", label: "Hoje", href: "/painel" },
  { key: "treinos", label: "Treinos", comingSoon: true },
  { key: "progresso", label: "Progresso", comingSoon: true },
  { key: "perfil", label: "Perfil", comingSoon: true },
];
