# SPRINT-06 — Catálogo de Exercícios

Status: em andamento — execução autônoma integral autorizada pelo Produto.

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

- FIT-020 (#42) — Integração e prova técnica da API Ninjas.
- FIT-021 (#43) — Importação e persistência do catálogo global.
- FIT-022 (#44) — Gestão de exercícios próprios.
- FIT-023 (#45) — Catálogo unificado, busca e detalhes. Encerra a SPRINT-06.

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

Reservado para o PR da FIT-023, conforme a regra desta Sprint de não criar PRs exclusivamente documentais.
