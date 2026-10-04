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
///
/// AjustesPainel/AjustesTelas (29/09/2026): a barra inferior mobile do
/// Personal passa a ser **Início, Alunos, Treinos, Perfil** (`compact`),
/// sem "Mais". Exercícios, Financeiro e Assinatura continuam destinos
/// reais: no rail desktop (lista completa) e, no mobile, no menu de conta
/// aberto pelo avatar do cabeçalho — nenhum destino fica inacessível.
export const PERSONAL_NAV_ITEMS: AppShellNavItem[] = [
  { key: "inicio", label: "Início", href: "/painel", icon: "inicio", compact: true },
  { key: "alunos", label: "Alunos", href: "/painel/alunos", icon: "alunos", compact: true },
  { key: "treinos", label: "Treinos", href: "/painel/treinos", icon: "treinos", compact: true },
  { key: "exercicios", label: "Exercícios", href: "/painel/exercicios", icon: "exercicios" },
  { key: "financeiro", label: "Financeiro", href: "/painel/financeiro", icon: "financeiro" },
  { key: "perfil", label: "Perfil", href: "/painel/perfil", icon: "perfil", compact: true, accountLink: true },
  { key: "assinatura", label: "Assinatura", href: "/painel/assinatura", icon: "assinatura" },
  { key: "config", label: "Configurações", comingSoon: true, icon: "config" },
];

/// "Perfil" passa a ser real na FIT-016 (nome, e-mail, logout); "Treino"
/// passa a ser real na FIT-033 (visão somente leitura do plano atribuído);
/// "Progresso" passa a ser real na FIT-042 (própria evolução, somente
/// leitura). Agenda e Mensagens continuam fora do MVP.
///
/// AjustesTelas (29/09/2026, prints 24–27): "Início, Treino, Progresso,
/// Perfil" — "Hoje" passa a "Início" (mesmo rótulo dos outros papéis).
export const ALUNO_NAV_ITEMS: AppShellNavItem[] = [
  { key: "hoje", label: "Início", href: "/painel", icon: "inicio", compact: true },
  { key: "treino", label: "Treino", href: "/painel/treino", icon: "treinos", compact: true },
  { key: "progresso", label: "Progresso", href: "/painel/progresso", icon: "evolucao", compact: true },
  { key: "perfil", label: "Perfil", href: "/painel/perfil", icon: "perfil", compact: true, accountLink: true },
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
///
/// AjustesTelas (29/09/2026, prints 28–33): "Início, Treinos, Evolução,
/// Perfil". "Perfil" do Livre passa a ser real nesta rodada —
/// `/painel/perfil` agora também atende o papel INDIVIDUAL (dados da
/// conta, do espaço, perfil de treino do onboarding, resumo da assinatura
/// e "Sair"), então deixa de ser omitido. "Assinatura" continua real: no
/// rail desktop e, no mobile, no menu de conta do avatar.
export const INDIVIDUAL_NAV_ITEMS: AppShellNavItem[] = [
  { key: "hoje", label: "Início", href: "/painel", icon: "inicio", compact: true },
  { key: "treinos", label: "Treinos", href: "/painel/meus-treinos", icon: "treinos", compact: true },
  { key: "progresso", label: "Evolução", href: "/painel/minha-evolucao", icon: "evolucao", compact: true },
  { key: "perfil", label: "Perfil", href: "/painel/perfil", icon: "perfil", compact: true, accountLink: true },
  // FIT-122: "Assinatura" (FitOS Livre) já é real.
  { key: "assinatura", label: "Assinatura", href: "/painel/assinatura", icon: "assinatura" },
];
