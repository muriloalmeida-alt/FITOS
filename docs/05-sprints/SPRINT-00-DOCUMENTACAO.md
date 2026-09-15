# SPRINT-00 — Fundação Documental e Governança

Status: em revisão  
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

Preencher após o merge:

- Entregue:
- Não entregue:
- Decisões tomadas:
- Riscos:
- Próxima Sprint proposta:
