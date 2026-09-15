# Documentação FitOS

Este diretório é a fonte oficial das decisões de Produto, Design e entrega do FitOS.

## 00 — Governança

- `00-governanca/GOVERNANCA.md`
- `00-governanca/DEFINITION-OF-DONE.md`
- `00-governanca/ROADMAP.md`

## 01 — Produto

- `01-produto/PRD-01-MVP.md`
- `01-produto/REGRAS-DE-NEGOCIO.md`
- `01-produto/MODELO-DE-DADOS.md`

## 02 — Integrações

- `02-integracoes/INTEGRACAO-API-NINJAS.md`

## 03 — Design

- `03-design/PRODUCT-DESIGN.md`
- `03-design/BENCHMARK-IDENTIDADE-VISUAL.md`
- `03-design/M3-DESIGN-TOKENS.md`
- `03-design/UX-ARCHITECTURE.md`
- `03-design/COMPONENT-LIBRARY.md`
- `03-design/CRITICAL-SCREEN-SPECS.md`
- `03-design/RESEARCH-AND-TESTING-PLAN.md`
- `03-design/DESIGN-GOVERNANCE.md`

## 04 — Backlog

- `04-backlog/BACKLOG-MVP.md`

## 05 — Sprints

- `05-sprints/SPRINT-00-DOCUMENTACAO.md`

## 06 — Engenharia

- `06-engenharia/PROMPT-CLAUDE-CODE.md`

## Regras rápidas

- Toda entrega funcional nasce de uma história identificada.
- Toda história pertence a um Épico e a uma Sprint.
- Toda mudança chega à `main` por PR.
- Commits, pushes e merges diretos na `main` são proibidos, inclusive para documentação, configuração e hotfix.
- Toda formalização da entrega deve constar no PR; decisões permanentes devem atualizar também o documento correspondente no mesmo PR.
- O PR deve atualizar documentação quando houver decisão ou alteração de comportamento.
- Segredos e dados reais nunca são documentados ou versionados.
- Identificadores, convenção de branch e de título de PR são únicos em todo o projeto (inclusive design): `docs/00-governanca/GOVERNANCA.md`.
