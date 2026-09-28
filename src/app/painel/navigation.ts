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
///
/// Ordem redefinida na FIT-117 (fundação visual/shell do redesign
/// mobile-first): os 3 primeiros da lista são exatamente os que a barra
/// compacta mostra sem "Mais" (ver `MAX_COMPACT_ITEMS` em `AppShell.tsx`) —
/// "Início/Alunos/Treinos" é a combinação especificada pelo protótipo
/// (`personal.js`), não "Início/Alunos/Exercícios" que a ordem anterior
/// produzia. "Perfil" passa a ser real na PR4 do redesign (FIT-120):
/// `/painel/perfil` agora também atende o papel PERSONAL (a mesma rota já
/// existia para o ALUNO desde a FIT-016) — dados profissionais (celular/
/// CREF/faixa de alunos) e um resumo real da assinatura, com link para a
/// gestão completa em `/painel/assinatura` (FIT-122, item próprio abaixo).
/// "Configurações" continua `comingSoon` — nenhuma tela própria para ela
/// ainda.
export const PERSONAL_NAV_ITEMS: AppShellNavItem[] = [
  { key: "inicio", label: "Início", href: "/painel", icon: "inicio" },
  { key: "alunos", label: "Alunos", href: "/painel/alunos", icon: "alunos" },
  { key: "treinos", label: "Treinos", href: "/painel/treinos", icon: "treinos" },
  { key: "exercicios", label: "Exercícios", href: "/painel/exercicios", icon: "exercicios" },
  { key: "financeiro", label: "Financeiro", href: "/painel/financeiro", icon: "financeiro" },
  { key: "perfil", label: "Perfil", href: "/painel/perfil", icon: "perfil" },
  { key: "assinatura", label: "Assinatura", href: "/painel/assinatura", icon: "assinatura" },
  { key: "config", label: "Configurações", comingSoon: true, icon: "config" },
];

/// "Perfil" passa a ser real na FIT-016 (nome, e-mail, logout); "Treino"
/// passa a ser real na FIT-033 (visão somente leitura do plano atribuído);
/// "Progresso" passa a ser real na FIT-042 (própria evolução, somente
/// leitura). Agenda e Mensagens continuam fora do MVP.
export const ALUNO_NAV_ITEMS: AppShellNavItem[] = [
  { key: "hoje", label: "Hoje", href: "/painel", icon: "inicio" },
  { key: "treino", label: "Treino", href: "/painel/treino", icon: "treinos" },
  { key: "progresso", label: "Progresso", href: "/painel/progresso", icon: "evolucao" },
  { key: "perfil", label: "Perfil", href: "/painel/perfil", icon: "perfil" },
];

/// Navegação do workspace individual do FitOS Livre (FIT-100/FIT-101),
/// mesma arquitetura de `04_FASE_2_2_FITOS_LIVRE.md` do pacote pós-MVP:
/// "Hoje, Treinos, Progresso, Perfil". "Hoje" (FIT-100), "Treinos"
/// (builder, FIT-102) e "Progresso" (histórico/frequência/recordes/
/// medidas/metas, FIT-104, em `/painel/minha-evolucao` — rota própria,
/// nunca `/painel/progresso`, que é exclusiva do `requireStudent()` do
/// aluno) já são reais.
///
/// "Perfil" não tem rota própria ainda — diferente do personal/aluno
/// (que mostram "Perfil" `comingSoon`, "Em breve"), o pacote visual 2026
/// (FIT-131) instrui explicitamente a não exibir o item para o papel
/// INDIVIDUAL enquanto a rota não existir, em vez de um destino
/// permanente desabilitado. Decisão escopada só ao Livre — o
/// "Configurações" do personal continua `comingSoon`, o pacote não pediu
/// o mesmo para ele. Efeito colateral: com só 4 destinos reais, a barra
/// compacta do Livre nunca precisa do overflow "Mais".
export const INDIVIDUAL_NAV_ITEMS: AppShellNavItem[] = [
  { key: "hoje", label: "Hoje", href: "/painel", icon: "inicio" },
  { key: "treinos", label: "Treinos", href: "/painel/meus-treinos", icon: "treinos" },
  { key: "progresso", label: "Progresso", href: "/painel/minha-evolucao", icon: "evolucao" },
  // FIT-122: "Assinatura" (FitOS Livre) já é real.
  { key: "assinatura", label: "Assinatura", href: "/painel/assinatura", icon: "assinatura" },
];
