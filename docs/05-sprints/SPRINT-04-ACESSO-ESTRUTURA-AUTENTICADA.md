# SPRINT-04 — Acesso e Estrutura Autenticada

Status: em andamento — FIT-009, FIT-010 e FIT-011 concluídas (mergeadas); FIT-012 implementada, em revisão (encerra a Sprint ao ser mergeada)

## Objetivo

Entregar a primeira experiência autenticada do FitOS: contas de personal, acesso de aluno previamente vinculado, provisionamento automático do tenant, autorização derivada da sessão no servidor, e navegação autenticada responsiva — sem antecipar nenhuma funcionalidade de negócio (Alunos, Exercícios, Treinos, Financeiro).

## Épico

- EPIC-03 — Identidade, Acesso e Navegação (#21, `docs/04-backlog/EPIC-03-IDENTIDADE-ACESSO-NAVEGACAO.md`), aberta nesta rodada.

## Pré-condição verificada antes do início

- `main` sincronizada, no commit `c7d29ec95b7953223c9ba902d801c844ffbf9404` (merge do PR #20, FIT-008).
- FIT-006, FIT-007 e FIT-008 mergeadas — SPRINT-03 concluída em código.
- `npm run lint`, `npm run typecheck`, `npm run test` (23/23) e `npm run build` passando na `main` antes do início desta Sprint.
- Nenhuma migration já aplicada foi alterada retroativamente.
- Risco herdado da FIT-008 (não bloqueante, registrado, carregado adiante): não há evidência direta de que as migrations da FIT-007/008 foram efetivamente aplicadas no PostgreSQL de homologação Railway — apenas evidência indireta (deployment `SUCCESS`, `/api/ready` respondendo 200). Ver `docs/06-engenharia/evidencias/FIT-008/DEPLOY-HOMOLOGACAO.md`, seção 5. Este risco é acompanhado, não uma pendência bloqueante da SPRINT-04; não foi aberto PR documental exclusivo para tratá-lo.

## Histórias

- FIT-009 (#22) — Prova técnica e implementação da autenticação. **Concluída** (PR #26, mergeado no commit `2ded79fcd920734c2736ec7b6b61442b7c36c63c`).
- FIT-010 (#23) — Provisionamento do tenant do personal. **Concluída** (PR #27, mergeado no commit `8a16d57e3aea093fc0f52ac72c405fb4a0097fbc`).
- FIT-011 (#24) — Autorização, papéis e isolamento por sessão. **Concluída** (PR #28, mergeado no commit `370ddc63d127323ad597a5a70f6c937d213608d9`).
- FIT-012 (#25) — Shell autenticado e navegação responsiva. **Implementada, em revisão** (PR próprio, sem merge). Encerra a SPRINT-04 ao ser mergeada.

## Resultado intermediário — FIT-009

- ADR-002 (Better Auth) avaliada com prova técnica real contra a stack atual (Next.js 16.3.5, React 19.3.0, Prisma 6.19.3, PostgreSQL 16) — decisão registrada em `docs/06-engenharia/arquitetura/adr/ADR-002-BETTER-AUTH-COMO-CANDIDATO.md`;
- `better-auth` 1.7.5 (última versão estável, não beta/rc) integrado via adapter Prisma;
- schema físico estendido de forma aditiva (nova migration): `User` recebe `role`, `emailVerified`, `image`, `updatedAt`; novos modelos `Session`, `Account`, `Verification`;
- cadastro (`/criar-conta`) e login (`/entrar`) de personal, com validação de formulário, prevenção de submissão duplicada e mensagens de erro que não revelam existência de conta;
- aluno sem cadastro público — apenas login, sem rota de auto-cadastro;
- sessão acessível no servidor; rota autenticada provisória protegida; logout funcional;
- testes automatizados contra PostgreSQL real cobrindo cadastro, duplicidade, login, proteção de rota e ausência de cadastro público de aluno;
- nenhuma credencial em log, código, PR ou documentação.

## Resultado intermediário — FIT-010

- `ensureTenantForPersonal` (`src/modules/tenancy/`): função idempotente e segura sob concorrência (constraint física `tenants.ownerId @unique` da FIT-007 resolve corridas) que garante exatamente um tenant por personal;
- provisionamento automático via `databaseHooks.user.create.after` do Better Auth — o tenant já existe imediatamente após o cadastro, sem chamada adicional;
- reparo idempotente (`provisionTenantForCurrentSession`) para o caso raro de o hook falhar — usado por `/painel`, que agora exibe o nome do tenant;
- aluno nunca provisiona tenant (rejeitado explicitamente); usuário não autenticado nunca provisiona (retorna `null` sem tocar o banco);
- nome do tenant: `"Espaço de {primeiro nome}"`, decisão documentada em `docs/06-engenharia/arquitetura/PROVISIONAMENTO-DE-TENANT.md`;
- nenhuma migration nova necessária — a constraint física já existia desde a FIT-007;
- testes cobrindo provisionamento normal, idempotência, concorrência (3 chamadas simultâneas), rejeição para aluno, reparo de personal sem tenant, personal com tenant existente, e o fluxo real de ponta a ponta (cadastro → tenant já provisionado).

## Resultado intermediário — FIT-011

- `AuthContext` (`src/modules/tenancy/authContext.ts`): contexto de autorização único, derivado exclusivamente da sessão do servidor e das tabelas físicas `Tenant`/`Student` — nunca de `tenantId`/`studentId` enviado pelo cliente;
- `getAuthContext`, `requireSession`, `requirePersonal`, `requireStudent`, `assertTenantAccess`, `authErrorResponse` — API completa de autorização, com 401 para não autenticado e 403 para autenticado sem permissão, usados coerentemente (nunca 404 automático para negar acesso);
- caso "aluno sem vínculo" (sessão válida, sem `Student` correspondente) tratado como estado real (403), nunca como erro interno;
- três rotas de prova (`/api/auth/context`, `/api/tenancy/meu-tenant`, `/api/tenancy/meu-perfil`) comprovando a camada de ponta a ponta, inclusive contra um servidor real com cadastro/login reais e cookies de sessão reais — sem nenhuma funcionalidade de negócio adicional;
- nenhuma migration nova necessária — toda a informação usada (`role`, `Tenant`, `Student`) já existia (FIT-007/FIT-009);
- testes negativos comprovando isolamento entre tenants, rejeição de papel trocado, rejeição de payload/query string adulterados (`tenantId`/`studentId` de outro usuário sempre ignorados) e sessão inválida;
- decisão documentada em `docs/06-engenharia/arquitetura/AUTORIZACAO-E-PAPEIS.md`.

## Resultado intermediário — FIT-012

- Rota única (`/painel`) decide no servidor, a partir da sessão e do `AuthContext` (FIT-011), qual shell renderizar — não existem rotas separadas por papel, então não há URL para adulterar e trocar de shell;
- `AppShell` (`src/shared/ui/`): componente de navegação responsiva compartilhado (barra inferior em compact, rail lateral em ≥ 840px), sem dependência de `identity`/`tenancy`;
- nenhuma funcionalidade futura simulada — destinos não implementados (Alunos, Treinos, Financeiro, Configurações; Treino, Progresso, Perfil de aluno) aparecem como "Em breve", desabilitados, nunca como link ou rota fictícia;
- agrupamento "Mais" para o 5º destino do personal na navegação compacta, conforme `UX-ARCHITECTURE.md`;
- caso "aluno sem vínculo" (FIT-011) resolvido com uma tela mínima de "sem permissão", sem shell — não um erro;
- logout funcional a partir dos três estados (`PersonalHome`, `AlunoHome`, `AlunoSemVinculo`);
- temas claro/escuro já funcionavam desde a fundação do projeto (tokens M3) — nenhum código novo necessário;
- acessibilidade básica: `aria-current`, `aria-disabled`, `aria-expanded`, área de toque mínima de 48dp, foco visível herdado do estilo global;
- nenhuma migration nova necessária; decisão documentada em `docs/06-engenharia/arquitetura/SHELL-AUTENTICADO.md`.

## Sequenciamento obrigatório

As Histórias não são paralelas:

1. FIT-009 é implementada e submetida a PR. *(concluído — PR #26 mergeado)*
2. Produto/Design/Gate Técnico revisa e autoriza o merge. *(concluído)*
3. Somente após o merge, FIT-010 pode iniciar. *(concluído — autorizado após o merge do PR #26)*
4. FIT-010 é implementada e submetida a PR. *(concluído — PR #27 mergeado)*
5. Produto/Design/Gate Técnico revisa e autoriza o merge. *(concluído)*
6. Somente após o merge, FIT-011 pode iniciar. *(concluído — autorizado após o merge do PR #27)*
7. FIT-011 é implementada e submetida a PR. *(concluído — PR #28 mergeado)*
8. Produto/Design/Gate Técnico revisa e autoriza o merge. *(concluído)*
9. Somente após o merge, FIT-012 pode iniciar. *(concluído — autorizado após o merge do PR #28)*
10. FIT-012 é implementada e submetida a PR. *(feito nesta rodada)*
11. Produto/Design/Gate Técnico revisa e autoriza o merge.
12. Fechamento documental da SPRINT-04 no próprio PR da FIT-012 — sem PR documental separado.

## Critérios de sucesso da Sprint

- ADR-002 recebe decisão final antes de qualquer implementação dependente ser tratada como consolidada;
- personal cria conta, autentica e acessa área protegida; credenciais inválidas são rejeitadas;
- aluno não possui cadastro público;
- tenant do personal é criado automaticamente e de forma idempotente (FIT-010);
- contexto de autorização (userId, role, tenantId) é derivado da sessão no servidor, nunca do cliente (FIT-011);
- isolamento entre tenants e entre alunos comprovado por testes negativos reais (FIT-011);
- shell autenticado de personal e de aluno implementado, responsivo, com Design System M3 e temas claro/escuro, sem simular funcionalidade futura (FIT-012);
- nenhuma credencial, token ou segredo versionado;
- nenhuma feature de negócio (Alunos, Exercícios, Treinos, Financeiro) implementada além da estrutura mínima de acesso;
- cada História possui PR próprio e merge explicitamente autorizado por SHA exato.

## Decisões preservadas

- Better Auth: ADR-002 avaliada nesta Sprint com prova técnica real (FIT-009) — ver seção acima e o PR da FIT-009 para o resultado.
- 1 personal = 1 tenant — já garantido por constraint física (FIT-007); FIT-010 garante também o provisionamento automático no fluxo de cadastro.
- `tenant_id` nunca confiado ao cliente — a estratégia de dados já existia (FIT-007); esta Sprint implementa a derivação real a partir da sessão autenticada, cumprindo o que a documentação da FIT-007 registrava como dependência de uma "História futura da prova técnica de autenticação".
- Design System M3 (`docs/03-design`) aplicado integralmente, sem biblioteca visual paralela.

## Não incluído

- OAuth, login social, MFA, passkeys, recuperação de senha por SMS;
- gestão completa de Alunos, Exercícios, Treinos, Financeiro;
- assinatura SaaS produtiva, cobrança, múltiplos personais por tenant, administração de academias, superadministrador, impersonação;
- qualquer produção funcional além do que já existe (Railway de homologação da FIT-008).

## Risco de governança conhecido

A FIT-003 (#4, proteção técnica da `main`) continua tratada conforme o estado real do repositório — `main` permanece `"protected": false`. A disciplina de branch/PR/merge autorizado permanece a única salvaguarda efetiva.

## Fechamento

Preenchido no PR da FIT-012 (conforme a regra desta Sprint de não criar PRs exclusivamente documentais), refletindo o estado no momento da submissão — a confirmação final do merge desta última História é registrada por atualização direta deste arquivo e da Issue #25 após a autorização explícita do Produto/Design/Gate Técnico.

- **Histórias e PRs**: FIT-009 (#22, PR #26, `2ded79fcd920734c2736ec7b6b61442b7c36c63c`); FIT-010 (#23, PR #27, `8a16d57e3aea093fc0f52ac72c405fb4a0097fbc`); FIT-011 (#24, PR #28, `370ddc63d127323ad597a5a70f6c937d213608d9`); FIT-012 (#25, PR próprio desta rodada) — todas com merge explicitamente autorizado por SHA exato, nenhuma exceção.
- **ADR-002 (Better Auth)**: decisão final `Aceito`, com prova técnica real (FIT-009) — `docs/06-engenharia/arquitetura/adr/ADR-002-BETTER-AUTH-COMO-CANDIDATO.md`.
- **EPIC-03 (#21)**: as 4 Historias planejadas (FIT-009 a FIT-012) foram entregues; o Épico permanece aberto até confirmação final do Produto de que não há mais escopo pendente para "Identidade, Acesso e Navegação" no MVP (a lista de "Fora do escopo" do Épico continua válida e não foi antecipada).
- **Produção/infraestrutura**: nenhuma ação em Railway/homologação foi realizada nesta Sprint (mesma limitação de acesso já registrada desde a FIT-008); nenhuma migration retroativamente alterada.
- **Governança**: nenhum commit ou push direto à `main` em nenhuma das 4 Histórias — todo código chegou a `main` exclusivamente por merge de PR explicitamente autorizado pelo SHA exato do head no momento do merge. Nenhuma credencial, token ou segredo commitado em nenhuma rodada.
- **Risco herdado, não resolvido nesta Sprint**: migrations da FIT-007/008 sem comprovação direta de aplicação no Railway de homologação (registrado desde a FIT-008, carregado sem alteração).
- **Risco corrigido nesta Sprint**: o registro de "nenhuma mitigação de rate limiting" na FIT-009 estava incorreto — corrigido na FIT-012 ao descobrir que o Better Auth já limita `/sign-in`/`/sign-up` por padrão (3 requisições/10s por IP, em memória) — ver `AUTENTICACAO-E-SESSAO.md` e `docs/06-engenharia/evidencias/FIT-012/README.md`.

### Proposta de próxima Sprint (não iniciada)

Sem autorização para começar: a EPIC-03 entrega identidade/acesso/navegação minimamente reais; o próximo Épico natural do MVP (ver `docs/04-backlog/BACKLOG-MVP.md`/`ROADMAP.md`) é a gestão real de Alunos (cadastro, perfil, vínculo com personal) — primeira funcionalidade de negócio sobre a estrutura entregue nesta Sprint. Fica como proposta para decisão do Produto, não como início de trabalho.
