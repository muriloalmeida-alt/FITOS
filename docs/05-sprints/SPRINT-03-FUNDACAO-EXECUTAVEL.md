# SPRINT-03 — Fundação Executável

Status: em andamento — FIT-006 em revisão (segunda rodada, após alterações obrigatórias de Produto/Design/Gate Técnico)

## Objetivo

Materializar a Fundação Técnica aprovada (EPIC-02) em uma aplicação executável e implantável, preservando as decisões de Produto, Design e Arquitetura e mantendo cada incremento pequeno, revisável e reversível.

## Épico

- EPIC-02 — Fundação Técnica (#10), mantida aberta.

## Histórias

- FIT-006 (#14) — Fundação executável do FitOS. **Implementada, em revisão** (PR próprio, sem merge).
- FIT-007 (#15) — Banco e modelo físico multi-tenant. **Não iniciada** — aguarda merge da FIT-006.
- FIT-008 (#16) — Ambientes FitOS no Railway. **Não iniciada** — aguarda merge da FIT-007.

## Sequenciamento obrigatório

As Histórias não são paralelas:

1. FIT-006 é implementada e submetida a PR. *(feito nesta rodada)*
2. Produto/Design revisa e autoriza o merge.
3. Somente após o merge, FIT-007 pode iniciar.
4. FIT-007 é implementada e submetida a PR.
5. Produto/Design revisa e autoriza o merge.
6. Somente após o merge, FIT-008 pode iniciar.
7. FIT-008 é implementada e submetida a PR.
8. Produto/Design revisa e autoriza o merge.

## Critérios de sucesso da Sprint

- aplicação Next.js/TypeScript executa localmente;
- organização do monólito modular está materializada sem acoplamento indevido;
- Material Design 3 e identidade FitOS possuem fundação técnica reutilizável;
- modelo físico multi-tenant implementa constraints e tenant derivado no servidor;
- PostgreSQL/Prisma possuem migrations rastreáveis;
- Railway possui ambientes e deploy rastreáveis, quando FIT-008 for executada;
- nenhum segredo real é versionado;
- nenhum candidato arquitetural é promovido sem prova técnica;
- nenhuma feature Pós-MVP é introduzida;
- cada História possui PR próprio e merge explicitamente autorizado.

## Decisões preservadas

- Next.js 16 + TypeScript + React 19: confirmado (App Router exige React 19; ver Fechamento da FIT-006).
- Monólito modular: confirmado.
- PostgreSQL + Prisma: confirmado (implementação na FIT-007).
- Railway: ADR-001 Aceito (implementação na FIT-008).
- Better Auth: ADR-002 Proposto, condicionado à prova técnica; fallback Clerk.
- Asaas: ADR-003 Proposto, condicionado à prova técnica; fallback Mercado Pago.
- 1 personal = 1 tenant no MVP.
- aluno vinculado a exatamente 1 personal/tenant.
- `tenant_id` derivado no servidor.
- `StudentCharge.status`: `pendente`, `pago`, `atrasado`, `cancelado`.
- assinatura SaaS separada do financeiro do aluno.

## Não incluído

- prova técnica Better Auth;
- prova técnica Asaas;
- autenticação produtiva;
- cobrança SaaS produtiva;
- integração produtiva API Ninjas;
- funcionalidades completas de Alunos, Exercícios, Treinos, Evolução ou Financeiro;
- IA, RPE/RIR, sync offline, vídeo obrigatório, Agenda, Mensagens, Relatórios avançados, Administração de academias, MFA/SSO e múltiplos personais por tenant.

## Risco de governança conhecido

A FIT-003 (#4, proteção técnica da `main`) pertence à EPIC-00 e continua sendo tratada conforme o estado real do repositório. Verificado nesta rodada: `main` permanece `"protected": false` (via `list_branches`). A SPRINT-03 não declara a `main` protegida e não altera a FIT-003. A disciplina de branch/PR/merge autorizado permanece obrigatória e é a única salvaguarda efetiva enquanto a proteção técnica não existir.

## Histórico de revisão da FIT-006

Na primeira rodada, a FIT-006 foi implementada com Next.js 15.5.25 + React 18, o que gerou uma vulnerabilidade residual moderada/alta transitiva do `postcss`. A revisão de Produto/Design/Gate Técnico no PR #17 determinou alterações obrigatórias: atualização para Next.js 16.3.5 + React 19.3.0 (a combinação correta, já que o App Router é alinhado ao React 19), geração e versionamento do `package-lock.json` por `npm install`/`npm ci` (sem transcrição manual), validação limpa completa e evidência visual anexada diretamente ao PR. Após a atualização, `npm audit` reporta zero vulnerabilidades — a pendência do `postcss` foi removida de `DECISOES-PENDENTES.md`.

## Fechamento

Preencher em PR documental posterior ao merge de cada História, conforme o padrão já usado na SPRINT-02. Como a SPRINT-03 tem três Histórias sequenciais, o fechamento final desta Sprint só ocorre após o merge da FIT-008.
