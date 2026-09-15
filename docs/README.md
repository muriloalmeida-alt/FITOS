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
- `04-backlog/EPIC-02-FUNDACAO-TECNICA.md`

## 05 — Sprints

- `05-sprints/SPRINT-00-DOCUMENTACAO.md`
- `05-sprints/SPRINT-01-PRODUCT-DESIGN.md`
- `05-sprints/SPRINT-02-FUNDACAO-TECNICA.md`

## 06 — Engenharia

- `06-engenharia/PROMPT-CLAUDE-CODE.md`
- `06-engenharia/arquitetura/README.md`
- `06-engenharia/arquitetura/VISAO-ARQUITETURAL.md`
- `06-engenharia/arquitetura/MODELO-MULTITENANT.md`
- `06-engenharia/arquitetura/MODELO-DE-DADOS-CONCEITUAL.md`
- `06-engenharia/arquitetura/AUTENTICACAO-E-AUTORIZACAO.md`
- `06-engenharia/arquitetura/ASSINATURA-SAAS.md`
- `06-engenharia/arquitetura/INTEGRACAO-API-NINJAS.md`
- `06-engenharia/arquitetura/SEGURANCA-E-LGPD.md`
- `06-engenharia/arquitetura/AMBIENTES-E-DEPLOY.md`
- `06-engenharia/arquitetura/OBSERVABILIDADE.md`
- `06-engenharia/arquitetura/ESTRATEGIA-DE-TESTES.md`
- `06-engenharia/arquitetura/DECISOES-PENDENTES.md`
- `06-engenharia/arquitetura/adr/README.md`
- `06-engenharia/arquitetura/adr/ADR-001-RAILWAY-COMO-PLATAFORMA.md`
- `06-engenharia/arquitetura/adr/ADR-002-BETTER-AUTH-COMO-CANDIDATO.md`
- `06-engenharia/arquitetura/adr/ADR-003-ASAAS-COMO-CANDIDATO.md`

## Regras rápidas

- Toda entrega funcional nasce de uma história identificada.
- Toda história pertence a um Épico e a uma Sprint.
- Toda mudança chega à `main` por PR.
- Commits, pushes e merges diretos na `main` são proibidos, inclusive para documentação, configuração e hotfix.
- Toda formalização da entrega deve constar no PR; decisões permanentes devem atualizar também o documento correspondente no mesmo PR.
- O PR deve atualizar documentação quando houver decisão ou alteração de comportamento.
- Segredos e dados reais nunca são documentados ou versionados.
- Identificadores, convenção de branch e de título de PR são únicos em todo o projeto (inclusive design e arquitetura): `docs/00-governanca/GOVERNANCA.md`.
