# SPRINT-03 — Fundação Executável

Status: em andamento — FIT-006 concluída; FIT-007 implementada, em revisão

## Objetivo

Materializar a Fundação Técnica aprovada (EPIC-02) em uma aplicação executável e implantável, preservando as decisões de Produto, Design e Arquitetura e mantendo cada incremento pequeno, revisável e reversível.

## Épico

- EPIC-02 — Fundação Técnica (#10), mantida aberta.

## Histórias

- FIT-006 (#14) — Fundação executável do FitOS. Concluída pelo PR #17, merge `c2920e87babe09db5d525d08c5939265486413b1`.
- FIT-007 (#15) — Banco e modelo físico multi-tenant. **Implementada, em revisão** (PR próprio, sem merge).
- FIT-008 (#16) — Ambientes FitOS no Railway. Não iniciada — aguarda merge autorizado da FIT-007.

## Resultado intermediário — FIT-006

- aplicação Next.js 16.3.5 + React 19.3.0 executável;
- TypeScript estrito e ESLint 9;
- `package-lock.json` versionado;
- `npm audit` com zero vulnerabilidades;
- Design System M3 materializado;
- estrutura modular criada sem regra de negócio;
- nenhuma persistência, autenticação, cobrança ou infraestrutura Railway implementada;
- evidências visuais versionadas;
- Issue #14 concluída.

## Resultado intermediário — FIT-007

- Prisma 6.19.3 + PostgreSQL 16, schema físico multi-tenant em `prisma/schema.prisma`;
- migration inicial reproduzível (`prisma migrate dev`/`migrate deploy`);
- constraints físicas: 1 personal = 1 tenant (`tenants.ownerId` único), aluno vinculado a exatamente 1 tenant (`students.userId` único), no máximo 1 assinatura SaaS por tenant (`saas_subscriptions.tenantId` único);
- `tenantId` denormalizado e indexado em toda tabela de domínio, para filtro direto sem depender de join;
- `StudentCharge` e `SaasSubscription` sem nenhuma relação Prisma entre si (verificado por teste);
- seeds exclusivamente sintéticos (`prisma/seed.ts`);
- testes de isolamento entre dois tenants (consulta, `updateMany`/`deleteMany` escopados por tenant errado, constraints únicas) contra PostgreSQL real;
- `npm audit` com zero vulnerabilidades (Prisma 6.19.3 escolhido deliberadamente sobre o Prisma 7, que exige um novo modelo de driver adapters — ver `docs/06-engenharia/arquitetura/MODELO-FISICO-DE-DADOS.md`);
- nenhuma autenticação, UI funcional, Railway ou cobrança real implementada.

## Sequenciamento obrigatório

As Histórias não são paralelas:

1. FIT-006 é implementada e submetida a PR. *(concluído — PR #17 mergeado)*
2. Produto/Design revisa e autoriza o merge. *(concluído)*
3. Somente após o merge, FIT-007 pode iniciar. *(concluído — autorizado após o merge do PR #18)*
4. FIT-007 é implementada e submetida a PR. *(feito nesta rodada)*
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

- Next.js 16 + TypeScript + React 19: confirmado (App Router exige React 19; ver Resultado intermediário da FIT-006).
- Monólito modular: confirmado.
- PostgreSQL + Prisma: confirmado e implementado na FIT-007 (Prisma 6.19.3, linha estável).
- Railway: ADR-001 Aceito (implementação na FIT-008).
- Better Auth: ADR-002 Proposto, condicionado à prova técnica; fallback Clerk.
- Asaas: ADR-003 Proposto, condicionado à prova técnica; fallback Mercado Pago.
- 1 personal = 1 tenant no MVP — agora com constraint física.
- aluno vinculado a exatamente 1 personal/tenant — agora com constraint física.
- `tenant_id` derivado no servidor — estratégia de dados implementada; derivação a partir de sessão real depende da prova técnica de autenticação.
- `StudentCharge.status`: `pendente`, `pago`, `atrasado`, `cancelado` — agora com enum físico.
- assinatura SaaS separada do financeiro do aluno — agora sem nenhuma relação física entre os modelos.

## Não incluído

- prova técnica Better Auth;
- prova técnica Asaas;
- autenticação produtiva;
- cobrança SaaS produtiva;
- integração produtiva API Ninjas;
- funcionalidades completas de Alunos, Exercícios, Treinos, Evolução ou Financeiro;
- IA, RPE/RIR, sync offline, vídeo obrigatório, Agenda, Mensagens, Relatórios avançados, Administração de academias, MFA/SSO e múltiplos personais por tenant;
- Railway/homologação (FIT-008).

## Risco de governança conhecido

A FIT-003 (#4, proteção técnica da `main`) pertence à EPIC-00 e continua sendo tratada conforme o estado real do repositório. `main` permanece `"protected": false` (via `list_branches`). A SPRINT-03 não declara a `main` protegida e não altera a FIT-003. A disciplina de branch/PR/merge autorizado permanece obrigatória e é a única salvaguarda efetiva enquanto a proteção técnica não existir.

## Histórico de revisão da FIT-006

Na primeira rodada, a FIT-006 foi implementada com Next.js 15.5.25 + React 18, o que gerou uma vulnerabilidade residual moderada/alta transitiva do `postcss`. A revisão de Produto/Design/Gate Técnico no PR #17 determinou alterações obrigatórias: atualização para Next.js 16.3.5 + React 19.3.0, geração e versionamento do `package-lock.json` por `npm install`/`npm ci` (sem transcrição manual), validação limpa completa e evidência visual anexada diretamente ao PR. Após a atualização, `npm audit` reportou zero vulnerabilidades. O PR #17 foi aprovado e mergeado no SHA `074ccc3e2dac1eaf165a4ec78ea3d81aad9a8eb5`, resultando no commit `c2920e87babe09db5d525d08c5939265486413b1` na `main`. O PR documental #18 (registro da conclusão da FIT-006 e autorização da FIT-007) foi mergeado no commit `337b96c84326eba4d4f6e7d2f36dacce248a889d`.

## Fechamento

Ainda não preenchido. Reservado para PR documental posterior ao merge da FIT-008, conforme o padrão já usado na SPRINT-02. Como a SPRINT-03 tem três Histórias sequenciais, o fechamento final desta Sprint só ocorre após o merge da FIT-008.
