# SPRINT-01 — Fundação de Product Design

Status: concluída  
Objetivo: publicar a identidade visual e o Design System (Material Design 3) do FitOS como fundação documental de UX/UI para as Fases funcionais do roadmap, com o escopo normalizado ao MVP confirmado por Produto — sem iniciar implementação de frontend ou backend.

## Épico

### EPIC-01 — Identidade Visual e Design System (Material Design 3)

Estabelecer marca, tokens M3, arquitetura de UX, biblioteca de componentes, especificação de telas críticas, plano de pesquisa e governança de design, todos aderentes ao escopo confirmado do MVP. Permanece aberta como container de rastreio (#6).

## História da Sprint

### FIT-004 — Publicar identidade visual e Design System (Material Design 3)

Como time do FitOS, queremos a identidade visual e o Design System M3 publicados e versionados, para que toda Fase funcional futura parta de tokens, componentes e telas críticas já decididos e alinhados ao escopo do MVP, em vez de improvisar solução visual própria ou incluir funcionalidades fora de escopo.

Critérios de aceite:

- Identidade de marca, tokens M3, arquitetura de UX, biblioteca de componentes, especificação de telas críticas, plano de pesquisa e governança de design publicados em `docs/03-design/`.
- Documentação alinhada ao escopo confirmado do MVP: autenticação e conta do personal **e do aluno** (aluno com acesso próprio, restrito ao tenant do personal ao qual está vinculado), cadastro e gestão de alunos, biblioteca de exercícios, integração com API Ninjas, montagem e atribuição de treinos, execução e registro de treinos, evolução básica do aluno, gestão financeira e dashboard operacional.
- IA (recomendação/criação de treino), RPE/RIR, sincronização offline, vídeo como requisito obrigatório, agenda, mensagens, relatórios avançados e administração de academias identificados exclusivamente como "Pós-MVP" ou "Hipótese sujeita à decisão de Produto" — nunca como funcionalidade disponível nos fluxos, telas ou eventos analíticos atuais.
- Estados financeiros persistidos normalizados a `pendente`, `pago`, `atrasado` e `cancelado`; "a vencer" apenas como apresentação calculada; sem pagamento parcial nem estorno.
- Matriz de aderência ao escopo publicada em `docs/03-design/PRODUCT-DESIGN.md`, incluindo a autenticação do aluno como capacidade MVP.
- Roadmap único (sem trilha de design paralela) e índice de documentação atualizados.
- Asset visual de referência (`fitos-concept-board.png`) tratado como opcional e não bloqueante do aceite.
- Esta entrega acontece por PR, sem alteração direta na `main`.
- Nenhuma implementação de código, arquitetura técnica ou integração efetiva é realizada nesta Sprint.

## Escopo incluído

- Identidade de marca e Design System M3 (documental).
- Reconciliação de estrutura de pastas, convenção de branch/PR e roadmap com a governança já vigente.
- Normalização do escopo documental ao MVP confirmado por Produto, incluindo o acesso do aluno via conta própria.
- Matriz de aderência ao escopo.

## Escopo excluído

- Implementação de código da aplicação (frontend/backend).
- Definição detalhada de arquitetura técnica (inclui autenticação/multi-tenancy técnico, ex.: Better Auth — fica para a futura fundação de arquitetura).
- Implementação do Design System em componentes reais (ex.: React).
- Integração efetiva com a API Ninjas.
- Auditoria completa de aderência do repositório `FitOS` existente.
- Execução do plano de pesquisa com usuários reais.

## Evidência esperada

- PR #8 com toda a documentação de `docs/03-design/`, `docs/00-governanca/ROADMAP.md` e `docs/README.md` atualizados e alinhados ao escopo do MVP.
- Aprovação do Product Owner e do Product Manager/Product Designer (GPT do Murilo).

## Fechamento

- **Entregue:**
  - Documentação integral da FIT-004: benchmark e identidade visual, tokens M3 (claro/escuro), arquitetura de UX, biblioteca de componentes, especificação das telas críticas, plano de pesquisa e validação, e governança de design — todos em `docs/03-design/`.
  - `docs/03-design/PRODUCT-DESIGN.md` como visão geral/índice, com a Matriz de aderência ao escopo (Seção 11).
  - `docs/00-governanca/ROADMAP.md` com a Trilha de Design vinculada a esta Sprint, e `docs/README.md` indexando todos os novos documentos.
  - Épico EPIC-01 (#6, aberto como container de rastreio) e História FIT-004 (#7, concluída e fechada).
  - PR #8 (`[FIT-004] Identidade visual e Design System M3`), revisado em três rodadas por Produto e Design, aprovado e mergeado na `main` exclusivamente pelo fluxo de PR.

- **Não entregue (deliberadamente fora desta Sprint):**
  - Concept board (`fitos-concept-board.png`) — mantido como referência visual opcional fora do repositório, por decisão de Produto e Design e por risco de corrupção binária na ferramenta de escrita disponível.
  - Execução futura das pesquisas: o plano de pesquisa e validação (`RESEARCH-AND-TESTING-PLAN.md`) foi documentado, mas nenhuma entrevista, teste de conceito ou teste de usabilidade foi realmente executado nesta Sprint — é trabalho de pesquisa a ser conduzido posteriormente.

- **Decisões tomadas:**
  - Identidade de marca "Sistema em movimento" (paleta OS Navy/Motion Lime/Flow Teal/Cloud/Graphite, tipografia Manrope) **aprovada** por Produto e Design.
  - **Material Design 3** confirmado como Design System oficial do FitOS.
  - **EPIC-01 como Épico próprio** (não História do EPIC-00), por seu caráter transversal às fases funcionais — confirmado por Produto e Design.
  - Escopo do MVP normalizado: IA, RPE/RIR, sincronização offline, vídeo obrigatório, agenda, mensagens, relatórios avançados e administração de academias tratados exclusivamente como "Pós-MVP" ou "Hipótese"; estados financeiros restritos a `pendente`/`pago`/`atrasado`/`cancelado`.
  - **Acesso do personal e do aluno confirmado como capacidade do MVP**: ambos têm conta própria e autenticada, com o aluno restrito ao tenant do personal ao qual está vinculado — sem detalhamento de arquitetura técnica (Better Auth, multi-tenancy), que fica para a futura fundação de arquitetura.

- **Resultado:**
  - FIT-004 **concluída**, fechada pelo merge do PR #8.

- **Riscos residuais:**
  - A identidade de marca e a arquitetura de UX ainda não foram validadas com personal trainers e alunos reais — a Rodada 2 (teste de conceito) e a Rodada 3 (usabilidade moderada) de `RESEARCH-AND-TESTING-PLAN.md` permanecem pendentes de execução. Decisões de marca e de fluxo seguem, portanto, sujeitas a ajuste quando essa validação ocorrer.

- **SHA do merge:** `0518ab1554c10cb8777f3a313ce2f935ecdb5d0f` (PR #8 → `main`).

- **Próxima Sprint proposta:** **SPRINT-02 — Fundação Técnica**.
- **Próximo Épico proposto:** **EPIC-02 — Fundação Técnica**.
- **Próxima História proposta:** **FIT-005 — Definição da arquitetura da solução**.
