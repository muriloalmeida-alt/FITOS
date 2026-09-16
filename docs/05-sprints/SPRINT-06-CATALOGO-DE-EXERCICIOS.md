# SPRINT-06 — Catálogo de Exercícios

Status: concluída — execução autônoma integral autorizada pelo Produto, com pendência declarada de importação real (ver "Fechamento").

## Objetivo

Entregar um catálogo de exercícios utilizável pelo personal: exercícios globais importados de fonte externa autorizada, exercícios próprios restritos ao tenant, busca, filtros e detalhes. A consulta normal do catálogo funciona a partir do PostgreSQL, inclusive durante indisponibilidade da API externa. Escopo estritamente de exercícios — nenhuma montagem, prescrição ou execução de treino nesta Sprint.

## Épico

- EPIC-05 — Exercícios e Catálogo (#41, `docs/04-backlog/EPIC-05-EXERCICIOS-E-CATALOGO.md`), aberta nesta rodada.

## Pré-condição verificada antes do início

- `main` sincronizada, no commit `4f32ddc9f3af2fa2a92030b424b2aa1f11356500` — SPRINT-05 concluída e aprovada pelo Produto, incluindo a correção do PR #39 (recuperação de falha na ativação de conta do aluno).
- `Exercise` (`tenantId` opcional — nulo para catálogo global, preenchido para exercício próprio — `origin: API_NINJAS | PERSONAL`, `externalId`) e as duas triggers de isolamento (`enforce_workout_exercise_tenant`, `enforce_exercise_tenant_immutability`, migration `20260916000000_add_tenant_composite_constraints`) já existem desde a FIT-007 — esta Sprint estende esse modelo com campos aditivos, nunca o substitui nem edita a migration original.
- `docs/02-integracoes/INTEGRACAO-API-NINJAS.md` e `docs/06-engenharia/arquitetura/INTEGRACAO-API-NINJAS.md` já definem fluxo, controles e restrições comerciais — esta Sprint referencia esses documentos em vez de duplicá-los; a decisão técnica específica desta Sprint (plano, licença, classificação do que foi comprovado) fica em ADR próprio (`adr/ADR-004-API-NINJAS-EXERCICIOS.md`).
- Nenhuma chave nova da API Ninjas foi fornecida por canal seguro a esta Sprint. A chave mencionada em conversa anterior é tratada como exposta — nunca reutilizada, recuperada, transcrita ou registrada em nenhum artefato.
- Nenhum PR aberto conflitante. Nenhuma migration já aplicada foi alterada retroativamente.
- Colisão de identificadores resolvida: o backlog especulativo (`BACKLOG-MVP.md`, "Épico 3 — Exercícios") já usava FIT-020/021/022 para o mesmo tema geral, nunca promovido a Issue real. Renumerado para FIT-024/025/026, preservando ordem e conteúdo — ver nota no próprio arquivo.

## Autorização de execução

Autorização integral concedida pelo Produto para formalizar, implementar, testar, documentar e mergear as quatro Histórias em sequência, sem aprovação intermediária por PR — a única exigência contínua é que cada merge só ocorra após os critérios de aceite e os quality gates da própria História serem cumpridos, com o resultado do gate autônomo registrado no PR antes do merge. Nenhum plano/upgrade/custo na API Ninjas é contratado sem autorização específica do Produto.

## Histórias

- FIT-020 (#42) — Integração e prova técnica da API Ninjas. **Concluída** (PR #46, mergeado no commit `78ca0f573a67d52a46d6a9a7fca145d3bdc88762`).
- FIT-021 (#43) — Importação e persistência do catálogo global. **Concluída** (PR #47, mergeado no commit `677ae09a3dc8ffd4bd913d69f414de8d62da8b10`).
- FIT-022 (#44) — Gestão de exercícios próprios. **Concluída** (PR #48, mergeado no commit `ef309e95929345ba4d0437988d721204c4b9ba05`).
- FIT-023 (#45) — Catálogo unificado, busca e detalhes. Encerra a SPRINT-06. **Concluída** (PR #<PR_FIT023>, mergeado no commit `<SHA_FIT023>`).

## Resultado intermediário — FIT-020

- `src/integrations/api-ninjas/`: client isolado (`searchExercises`), adapter (`toExerciseDTO`), erros tipados (`ApiNinjasError`);
- `API_NINJAS_API_KEY` documentada em `.env.example`, server-side, opcional (ausência não impede a aplicação, apenas mantém a busca externa indisponível);
- ADR-004 classifica separadamente: client implementado (✅), contrato testado com fixture (✅), chamada real comprovada (❌), uso comercial autorizado (❌) — nenhuma chave nova foi fornecida a esta Sprint;
- 21 testes, inteiramente com fixtures — nenhuma chamada real feita ou afirmada;
- decisão documentada em `docs/06-engenharia/arquitetura/CATALOGO-DE-EXERCICIOS.md` e `adr/ADR-004-API-NINJAS-EXERCICIOS.md`.

## Resultado intermediário — FIT-021

- migration aditiva `20260916040000_add_exercise_catalog_fields`: campos de catálogo em `Exercise` (`type`, `muscle`, `equipments`, `difficulty`, `instructions`, `safetyInfo`, `updatedAt`) e índice único `[origin, externalId]` — testada em banco vazio (histórico completo) e como atualização do schema atual (`fitos_dev`/`fitos_test`); nenhum trigger de isolamento alterado;
- `src/modules/exercises/importExercises.ts`: `buildExternalId` (chave de deduplicação determinística — hash de nome/tipo/músculo/equipamento, deliberadamente sem dificuldade/instruções/informação de segurança, que podem ser corrigidas pelo fornecedor sem trocar o exercício), `importGlobalExercises` (upsert idempotente com o mesmo padrão de concorrência de `ensureTenantForPersonal`, falha parcial preserva o já importado, contagens recebidos/válidos/criados/atualizados/rejeitados/buscas com falha);
- `scripts/import-exercicios.ts` (`npm run import:exercises`): comando administrativo manual, nunca automático; protegido pela ausência de `API_NINJAS_API_KEY` (encerra sem nenhuma chamada de rede ou escrita, comprovado);
- nenhuma importação real ocorreu — sem chave nova nem confirmação de licença comercial (ver ADR-004), o gatilho real permanece indisponível por construção;
- decisão documentada em `docs/06-engenharia/arquitetura/CATALOGO-DE-EXERCICIOS.md`.

## Resultado intermediário — FIT-022

- migration aditiva `20260916050000_add_exercise_status`: `ExerciseStatus` (`ATIVO`/`ARQUIVADO`) e coluna `status` em `Exercise`; índice único parcial `(tenantId, lower(name)) WHERE origin = 'PERSONAL'` para duplicidade dentro do tenant — testada em banco vazio e como atualização do schema atual; nenhum trigger de isolamento alterado;
- `src/modules/exercises/exercises.ts`: `createOwnExercise`/`getOwnExerciseForTenant`/`updateOwnExercise`/`archiveExercise`/`reactivateExercise` — sempre `tenantId` da sessão, nunca aceitam `tenantId`/`origin` como campo editável; nunca retornam exercício de outro tenant nem exercício global; arquivamento idempotente, nunca exclusão física; auditoria (`EXERCICIO_EDITADO`/`ARQUIVADO`/`REATIVADO`) sem payload integral;
- rotas `POST /api/exercises`, `PATCH /api/exercises/[id]`, `POST /api/exercises/[id]/arquivar`, `POST /api/exercises/[id]/reativar` — todas via `requirePersonal()` (aluno nunca administra exercícios); nenhuma rota de listagem/detalhe nesta História (escopo exclusivo da FIT-023, que também entrega a UI);
- decisão documentada em `docs/06-engenharia/arquitetura/CATALOGO-DE-EXERCICIOS.md`.

## Resultado intermediário — FIT-023

- `src/modules/exercises/exercises.ts`: `listCatalogExercises`/`getCatalogExerciseForTenant` — catálogo unificado (global ativo + próprio ativo do tenant da sessão), busca por nome, filtros de músculo/tipo/dificuldade, ordenação e paginação estáveis; detalhe permanece acessível para exercício próprio arquivado (único caminho de reativação), nunca para exercício de outro tenant;
- `src/app/painel/exercicios/` (lista, cadastro, detalhe/edição) — item "Exercícios" real na navegação do personal, entre "Alunos" e "Treinos"; origem ("Global"/"Meu exercício") sempre visível; exercício global sempre somente leitura nesta UI; consulta normal nunca chama a API Ninjas, inclusive quando nenhum exercício global foi importado (estado vazio honesto);
- Design System M3/Manrope, temas claro/escuro, mobile/desktop — evidenciado em `docs/06-engenharia/evidencias/FIT-023/`;
- nenhuma migration nesta História;
- decisão documentada em `docs/06-engenharia/arquitetura/CATALOGO-DE-EXERCICIOS.md`.

## Sequenciamento obrigatório

1. FIT-020 é implementada e submetida a PR (inclui a formalização de SPRINT-06/EPIC-05 e o ADR-004 neste mesmo PR).
2. Gate autônomo aprova (critérios de aceite + quality gates); merge por SHA exato.
3. Somente após o merge, FIT-021 inicia automaticamente.
4. FIT-021 é implementada e submetida a PR.
5. Gate autônomo aprova; merge por SHA exato.
6. Somente após o merge, FIT-022 inicia automaticamente.
7. FIT-022 é implementada e submetida a PR.
8. Gate autônomo aprova; merge por SHA exato.
9. Somente após o merge, FIT-023 inicia automaticamente.
10. FIT-023 é implementada e submetida a PR, incluindo o fechamento documental da SPRINT-06.
11. Gate autônomo aprova; merge por SHA exato. Sprint encerrada.

## Critérios de sucesso da Sprint

- client e adapter da API Ninjas testados por contrato (fixtures), sem depender de rede real;
- catálogo global (quando importado) consultável mesmo com a API externa indisponível;
- personal cadastra, edita, arquiva e reativa exercícios próprios — apenas do próprio tenant;
- isolamento entre tenants comprovado por testes negativos reais em toda operação nova;
- catálogo unificado real no shell do personal — busca, filtro, paginação e detalhe funcionando contra PostgreSQL;
- nenhuma feature de negócio fora de exercícios (Treinos, Avaliações, Financeiro, Agenda, Mensagens) implementada;
- nenhuma credencial ou dado real versionado;
- situação real da licença/importação da API Ninjas declarada sem ambiguidade no fechamento;
- cada História possui PR próprio, gate autônomo registrado e merge explicitamente por SHA exato.

## Não incluído

- montagem, prescrição ou execução de treinos (Fase 3 do roadmap — `Workout`/`TrainingPlan`/`WorkoutExercise` além do que já existe);
- tradução por IA do conteúdo importado;
- upload/preview de imagem ou vídeo de execução;
- favoritos/recentes;
- importação real em massa do catálogo da API Ninjas sem licença/chave adequada confirmada;
- qualquer papel adicional além de PERSONAL/ALUNO.

## Risco de governança conhecido

A FIT-003 (#4, proteção técnica da `main`) continua tratada conforme o estado real do repositório — `main` permanece `"protected": false`. A disciplina de branch/PR/merge autorizado permanece a única salvaguarda efetiva.

## Fechamento

### O que foi entregue

Um personal cadastra, edita, arquiva e reativa exercícios próprios (restritos ao próprio tenant, nome único por tenant, arquivamento idempotente e nunca físico) e consulta um catálogo unificado real — busca por nome, filtros de músculo/tipo/dificuldade, paginação e detalhe — que combina exercícios globais ativos com os próprios ativos do tenant da sessão, com a origem de cada item sempre visível ("Global"/"Meu exercício"). A consulta normal do catálogo é inteiramente contra o PostgreSQL e nunca depende da API Ninjas estar disponível, inclusive quando nenhum exercício global foi importado (estado vazio honesto, não um erro). O client/adapter da API Ninjas (FIT-020) e o pipeline de importação/deduplicação/upsert idempotente (FIT-021) estão implementados, testados por contrato com fixtures e prontos para uso — mas nenhuma chamada real foi feita nesta Sprint.

### O que não foi entregue (pendência declarada, não uma falha de execução)

**Nenhum exercício global foi efetivamente importado em nenhum ambiente.** Conforme a restrição de segurança e de custo desta Sprint, nenhuma chave nova da API Ninjas foi fornecida por canal seguro, e a chave mencionada em conversa anterior a esta Sprint foi tratada como permanentemente exposta — nunca usada, recuperada, transcrita ou registrada em nenhum artefato (`.env.example`, ADR-004, código e testes documentam essa restrição explicitamente). Nenhum plano comercial foi contratado, alterado ou verificado. Consequentemente, o critério de sucesso "catálogo global (quando importado) consultável mesmo com a API externa indisponível" está estruturalmente pronto e coberto por testes de fixture, mas **não** pode ser marcado como comprovado com dado real — fica registrado como pendência explícita, não como item entregue, sem bloquear o restante da Sprint (exercício próprio e catálogo unificado são reais e independentes dessa pendência).

Fora de escopo por decisão de produto (igual às Sprints anteriores): montagem, prescrição ou execução de treinos; tradução por IA do conteúdo importado; upload/preview de imagem/vídeo; favoritos/recentes; qualquer papel adicional além de PERSONAL/ALUNO.

### Migrations e homologação

Três migrations aditivas nesta Sprint: `20260916040000_add_exercise_catalog_fields` (FIT-021), `20260916050000_add_exercise_status` (FIT-022); FIT-020 e FIT-023 não precisaram de migration. Nenhuma migration anterior foi alterada; nenhum trigger de isolamento (`enforce_workout_exercise_tenant`, `enforce_exercise_tenant_immutability`) foi removido ou modificado; nenhuma seed automática foi executada.

**Mesmo limite já registrado na SPRINT-05, mantido nesta**: as duas migrations foram comprovadas aplicando-as de fato (`prisma migrate deploy`) em `fitos_dev`/`fitos_test` — bancos locais ao ambiente de execução — e também contra um banco vazio criado e descartado só para o teste (histórico completo de migrations do zero). **Nenhum deploy, migration ou verificação de schema foi executado contra o ambiente de homologação do Railway nesta Sprint** — acesso ao Railway não esteve disponível a esta sessão. Os comandos que seriam necessários antes de qualquer promoção real: `railway run --service <serviço> npx prisma migrate deploy` (ou equivalente via variável `DATABASE_URL` de homologação), seguido de `railway run --service <serviço> npx prisma migrate status` (nunca só `/api/ready`, que atesta apenas que a aplicação está no ar e conectada a **algum** banco, não que o schema está no estado esperado) e de uma consulta direta a `_prisma_migrations` confirmando as duas migrations desta Sprint aplicadas. Nenhum desses comandos foi executado.

### Evidências

`docs/06-engenharia/evidencias/FIT-023/` — capturado com Playwright contra o build de produção (`npm run start`), fluxo real de UI/rotas para exercício próprio (criação, edição implícita nos formulários, busca, arquivamento, reativação); o único exercício com `origin: API_NINJAS` usado nas capturas foi inserido diretamente via Prisma só para existir algo a fotografar, explicitamente rotulado como não sendo uma importação real (ver README da evidência e ADR-004). Todos os dados sintéticos (tenant, personal, os dois exercícios) foram removidos do banco imediatamente após a captura.

### Riscos residuais

- A FIT-003 (proteção técnica da `main`) continua pendente — `main` permanece `"protected": false`; a disciplina de branch/PR/merge autorizado é a única salvaguarda efetiva (risco já conhecido, não introduzido por esta Sprint).
- A pendência de licença/chave da API Ninjas (acima) bloqueia apenas a importação real; não há workaround dentro do escopo desta Sprint, e nenhum foi tentado.
- Railway/homologação não verificado nesta Sprint (acima) — mesmo risco já registrado na SPRINT-05, ainda não endereçado.

### Estado final do EPIC-05

Todas as quatro Histórias (FIT-020 a FIT-023) concluídas e mergeadas — EPIC-05 encerrado nesta Sprint, com a pendência de importação real declarada explicitamente (não marcada como entregue).

### Confirmações

- Nenhuma chave da API Ninjas foi exposta, reutilizada, recuperada, transcrita ou registrada em nenhum artefato desta Sprint — `API_NINJAS_API_KEY` é lida apenas de variável de ambiente server-side, nunca `NEXT_PUBLIC_`, nunca aparece em log, mensagem de erro ou bundle de cliente (comprovado por teste automatizado e por verificação direta do bundle de produção).
- Nenhuma seed automática foi executada — os únicos dados criados fora de teste automatizado foram sintéticos, usados exclusivamente para evidência visual (incluindo o único exercício global sintético, inserido diretamente e claramente rotulado como tal), e removidos do banco imediatamente após a captura.
- Nenhum push direto em `main` em nenhuma História — todo código passou por PR e merge explícito por SHA validado.
- Nenhum ambiente de produção foi tocado — todo trabalho ocorreu em `fitos_dev`/`fitos_test` locais ao ambiente de execução; nenhum acesso ao Railway foi realizado.

### Proposta breve para a SPRINT-07 (não iniciada)

Conforme instrução explícita do Produto, a SPRINT-07 não foi iniciada nesta rodada. Candidatos naturais para a próxima Sprint, a critério do Produto: resolver a pendência de licença/chave da API Ninjas para viabilizar a importação real do catálogo global; ou avançar para a Fase 3 do roadmap (montagem/prescrição de treinos, `TrainingPlan`/`Workout`/`WorkoutExercise`), que agora tem um catálogo de exercícios real para referenciar.
