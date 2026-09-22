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
- `04-backlog/EPIC-03-IDENTIDADE-ACESSO-NAVEGACAO.md`
- `04-backlog/EPIC-04-CADASTRO-RELACIONAMENTO-ALUNOS.md`
- `04-backlog/EPIC-05-EXERCICIOS-E-CATALOGO.md`
- `04-backlog/EPIC-06-TREINOS-E-PLANOS.md`
- `04-backlog/EPIC-12-MONETIZACAO.md`
- `04-backlog/EPIC-13-FITOS-LIVRE.md`

## 05 — Sprints

- `05-sprints/SPRINT-00-DOCUMENTACAO.md`
- `05-sprints/SPRINT-01-PRODUCT-DESIGN.md`
- `05-sprints/SPRINT-02-FUNDACAO-TECNICA.md`
- `05-sprints/SPRINT-03-FUNDACAO-EXECUTAVEL.md`
- `05-sprints/SPRINT-04-ACESSO-ESTRUTURA-AUTENTICADA.md`
- `05-sprints/SPRINT-05-GESTAO-DE-ALUNOS.md`
- `05-sprints/SPRINT-06-CATALOGO-DE-EXERCICIOS.md`
- `05-sprints/SPRINT-07-TREINOS-E-PLANOS.md`

## 06 — Engenharia

- `06-engenharia/PROMPT-CLAUDE-CODE.md`
- `06-engenharia/EXECUCAO-LOCAL.md`
- `06-engenharia/DIARIO-DE-EXECUCAO-MVP.md`
- `06-engenharia/arquitetura/README.md`
- `06-engenharia/arquitetura/VISAO-ARQUITETURAL.md`
- `06-engenharia/arquitetura/MODELO-MULTITENANT.md`
- `06-engenharia/arquitetura/MODELO-DE-DADOS-CONCEITUAL.md`
- `06-engenharia/arquitetura/MODELO-FISICO-DE-DADOS.md`
- `06-engenharia/arquitetura/AUTENTICACAO-E-AUTORIZACAO.md`
- `06-engenharia/arquitetura/AUTENTICACAO-E-SESSAO.md`
- `06-engenharia/arquitetura/PROVISIONAMENTO-DE-TENANT.md`
- `06-engenharia/arquitetura/AUTORIZACAO-E-PAPEIS.md`
- `06-engenharia/arquitetura/SHELL-AUTENTICADO.md`
- `06-engenharia/arquitetura/GESTAO-DE-ALUNOS.md`
- `06-engenharia/arquitetura/CONVITE-E-ATIVACAO.md`
- `06-engenharia/arquitetura/ASSINATURA-SAAS.md`
- `06-engenharia/arquitetura/INTEGRACAO-API-NINJAS.md`
- `06-engenharia/arquitetura/CATALOGO-DE-EXERCICIOS.md`
- `06-engenharia/arquitetura/TREINOS-E-PLANOS.md`
- `06-engenharia/arquitetura/SEGURANCA-E-LGPD.md`
- `06-engenharia/arquitetura/AMBIENTES-E-DEPLOY.md`
- `06-engenharia/arquitetura/OBSERVABILIDADE.md`
- `06-engenharia/arquitetura/ESTRATEGIA-DE-TESTES.md`
- `06-engenharia/arquitetura/DECISOES-PENDENTES.md`
- `06-engenharia/arquitetura/adr/README.md`
- `06-engenharia/arquitetura/adr/ADR-001-RAILWAY-COMO-PLATAFORMA.md`
- `06-engenharia/arquitetura/adr/ADR-002-BETTER-AUTH-COMO-CANDIDATO.md`
- `06-engenharia/arquitetura/adr/ADR-003-ASAAS-COMO-CANDIDATO.md`
- `06-engenharia/arquitetura/adr/ADR-004-API-NINJAS-EXERCICIOS.md`
- `06-engenharia/arquitetura/adr/ADR-005-VERSIONAMENTO-DE-PLANOS.md`
- `06-engenharia/arquitetura/adr/ADR-006-WORKSPACE-INDIVIDUAL.md`
- `06-engenharia/arquitetura/adr/ADR-007-SELECAO-DE-PAPEL-NO-CADASTRO.md`

## Aplicação (FIT-006/FIT-007/FIT-009)

A partir da FIT-006, o repositório também contém o código-fonte da aplicação Next.js/TypeScript do FitOS (`src/`, `package.json`). A partir da FIT-007, o repositório também contém o modelo físico de dados (`prisma/`). A partir da FIT-009, a aplicação tem autenticação real (Better Auth) — ver `06-engenharia/arquitetura/AUTENTICACAO-E-SESSAO.md`. Execução local documentada em `06-engenharia/EXECUCAO-LOCAL.md`. O código segue a mesma governança desta documentação: toda mudança chega à `main` por PR revisado.

## Regras rápidas

- Toda entrega funcional nasce de uma história identificada.
- Toda história pertence a um Épico e a uma Sprint.
- Toda mudança chega à `main` por PR.
- Commits, pushes e merges diretos na `main` são proibidos, inclusive para documentação, configuração, código de aplicação e hotfix.
- Toda formalização da entrega deve constar no PR; decisões permanentes devem atualizar também o documento correspondente no mesmo PR.
- O PR deve atualizar documentação quando houver decisão ou alteração de comportamento.
- Segredos e dados reais nunca são documentados, versionados ou commitados.
- Identificadores, convenção de branch e de título de PR são únicos em todo o projeto (inclusive design, arquitetura e código): `docs/00-governanca/GOVERNANCA.md`.
