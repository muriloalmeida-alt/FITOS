# SPRINT-00 — Fundação Documental e Governança

Status: concluída  
Objetivo: tornar o GitHub a fonte oficial de produto e preparar o FitOS para entregas controladas por Sprint, Épico, História e PR.

## Épico

### EPIC-00 — Fundação do projeto

Criar uma base documental clara e rastreável para orientar Produto, Design e Engenharia.

## História da Sprint

### FIT-000 — Organizar documentação e governança

Como time do FitOS, queremos uma estrutura oficial de documentação, templates e requisitos organizados para que cada entrega tenha contexto, escopo, aceite e rastreabilidade, e para que a Engenharia receba o necessário para transformar o MVP em plano técnico incremental.

Critérios de aceite:

- `docs/` possui índice e organização por domínio.
- PRD, regras, modelo de dados, integração, backlog e design estão versionados.
- Governança define papéis, hierarquia, IDs, branches e fluxo.
- Existem templates de Épico, História e PR.
- Definition of Done está documentada.
- Esta entrega acontece por PR, sem alteração direta na `main`.
- A governança proíbe explicitamente commits, pushes e merges diretos na `main` e exige formalização completa nos PRs.
- Backlog possui prioridade e critérios de aceite.
- Prompt do Claude Code referencia os documentos oficiais.
- Integração API Ninjas separa MCP de desenvolvimento e REST de produção.
- Dúvidas técnicas devem retornar para decisão de Produto.

> Nota (1ª revisão): a história FIT-000A ("Preparar backlog para refinamento técnico"), inicialmente listada como história independente desta Sprint, foi incorporada à FIT-000 nesta revisão. O escopo era o mesmo Épico (EPIC-00) e a mesma entrega documental; mantê-la separada duplicava o vínculo de Sprint/Épico sem entregar valor isolado. A Sprint 00 passa a ter uma única História.

> Nota (2ª revisão — replanejamento): a proteção técnica da branch `main` **não integra o aceite da FIT-000**. A tentativa de configuração foi bloqueada nesta execução (o GitHub MCP Server disponível não expõe operação de branch protection/ruleset; `main` verificada com `"protected": false`). O Product Owner (Murilo Almeida) **aceitou temporariamente** esse risco para não bloquear o merge da FIT-000, e determinou que o item seja replanejado como história própria: **FIT-003 — Configurar proteção técnica da branch `main`**, vinculada ao EPIC-00. A proteção técnica **não existe** até a conclusão da FIT-003 — este documento não declara o contrário.

## Escopo incluído

- Estrutura documental.
- Governança e Definition of Done.
- Backlog inicial e roadmap.
- Templates para trabalho futuro.

## Escopo excluído

- Implementação do aplicativo.
- Configuração de infraestrutura.
- Integração real com API Ninjas.
- Criação das histórias técnicas posteriores.
- Proteção técnica da branch `main` — replanejada para a FIT-003.

## Evidência esperada

- PR com todos os documentos e templates.
- Revisão dos links internos.
- Aprovação do Product Owner.

## Fechamento

- **Entregue:**
  - Estrutura completa de `docs/` (governança, produto, integrações, design, backlog, sprints, engenharia) e README principal, publicados via PR #3.
  - Governança, Definition of Done e Roadmap versionados.
  - Templates de Épico, História e Pull Request em `.github/`.
  - Material Design 3 formalizado como Design System oficial em `docs/03-design/PRODUCT-DESIGN.md`, preservando mobile first, cores escuras com branco em destaque e a identidade visual do FitOS.
  - FIT-000A incorporada à FIT-000 (Sprint 00 com História única).
  - Épico EPIC-00 (#2) e História FIT-000 (#1, fechada por `Closes #1` no merge de #3).
  - PR #3 (`[FIT-000] Estrutura documental e governança inicial`) revisado em duas rodadas por Produto e Governança, aprovado e mergeado na `main` (commit `a5ec4ecfcff97c251781616ffe6c727a83db8327`) exclusivamente pelo fluxo de PR — nenhum commit, push ou merge direto na `main` em nenhuma etapa da Sprint.

- **Não entregue (replanejado, não perdido):**
  - Proteção técnica da branch `main` (PR obrigatório, aprovação mínima, invalidação em novo commit, conversas resolvidas, bloqueio de force-push/exclusão, sem bypass). Bloqueada nesta execução por indisponibilidade de ferramenta de branch protection/ruleset no GitHub MCP Server. Replanejada para a história **FIT-003 (#4)**, vinculada ao EPIC-00.

- **Decisões tomadas:**
  - Repositório oficial: `muriloalmeida-alt/New-FitOS`.
  - Material Design 3 adotado como Design System oficial, com tema customizado que preserva a identidade visual do FitOS.
  - FIT-000A incorporada à FIT-000.
  - Proteção técnica da `main` replanejada para a FIT-003 (#4), com **risco temporariamente aceito pelo Product Owner (Murilo Almeida)** para não bloquear o merge da FIT-000.
  - `INSTRUCOES-AO-CLAUDE.md` do pacote recebido não foi versionado (instrução operacional, fora do escopo documental do PR).

- **Riscos:**
  - **Risco aceito pelo Product Owner, ativo até a conclusão da FIT-003 (#4):** a `main` permanece sem proteção técnica (`"protected": false` em `2026-09-15`); o cumprimento da regra de PR obrigatório depende, por ora, da disciplina de quem tem acesso de escrita ao repositório.
  - Nenhum outro risco técnico identificado nesta Sprint.

- **Próxima Sprint proposta:**
  - SPRINT-01, com duas frentes: (1) conclusão da **FIT-003** — configuração efetiva da proteção da `main` por um administrador do repositório; (2) diagnóstico técnico solicitado em `docs/06-engenharia/PROMPT-CLAUDE-CODE.md`, transformando a documentação de produto em plano técnico incremental para o MVP.

## PR desta entrega

- Fundação documental e governança: <https://github.com/muriloalmeida-alt/New-FitOS/pull/3> — mergeado na `main` em `2026-09-15` (commit `a5ec4ecfcff97c251781616ffe6c727a83db8327`).
- Fechamento da Sprint (este registro): PR de acompanhamento aberto a partir da branch `docs/FIT-000-fechamento-sprint-00`.
