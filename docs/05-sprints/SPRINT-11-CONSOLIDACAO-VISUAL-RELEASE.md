# SPRINT-11 — Consolidação Visual e Release

Status: em andamento, checkpoint na branch única `feat/conclusao-integral-mvp`; sem PR nem merge intermediário. A Sprint só é considerada encerrada **de fato** após a aprovação do PR final do programa por GPT/Codex.

## Objetivo

Varredura final de acessibilidade (WCAG 2.2 AA) e consistência visual sobre tudo que já foi construído (SPRINT-00 a SPRINT-10), com correção real de qualquer achado, preparando o release candidate. É a Fase 7 do roadmap — a última Sprint do programa.

## Épico

- EPIC-10 — Consolidação Visual e Release (#71, `docs/04-backlog/EPIC-10-CONSOLIDACAO-VISUAL-RELEASE.md`), aberta nesta rodada.

## Nota de transparência

O pacote original de governança descrevia esta Sprint em arquivos de entrada (`07_SPRINT_11_CONSOLIDACAO_VISUAL_RELEASE.md`, `08_CONTRATO_VISUAL_OBRIGATORIO.md`) que existiram apenas na sessão original e não foram persistidos neste repositório. O texto exato não está disponível nesta continuação — o escopo abaixo foi reconstruído a partir da documentação de design/governança já versionada (`ROADMAP.md`, `M3-DESIGN-TOKENS.md`, `CRITICAL-SCREEN-SPECS.md`). Ver `docs/04-backlog/EPIC-10-CONSOLIDACAO-VISUAL-RELEASE.md` para o detalhe completo desta decisão — registrado para avaliação explícita da revisão externa.

## Pré-condição verificada antes do início

- `feat/conclusao-integral-mvp` no commit `3e85ce2` — SPRINT-10 concluída (FIT-060).
- Todas as telas de personal e aluno construídas nas SPRINT-03 a SPRINT-10 existem e passam nos próprios gates de cada História.

## Histórias

- FIT-070 (#72) — Consolidação visual e acessibilidade (WCAG 2.2 AA). Encerra a SPRINT-11 e o programa de execução integral.

## Sequenciamento

Uma única História, com seu commit/checkpoint na branch única, gate autônomo registrado no diário de execução.

## Critérios de sucesso da Sprint

- contraste AA comprovado matematicamente para os tokens M3 (claro e escuro);
- todo componente interativo compartilhado tem indicador de foco visível;
- nenhum elemento interativo aninhado dentro de outro (achado real corrigido em toda a aplicação, não só relatado);
- varredura responsiva real nos 4 breakpoints exigidos (360/768/1024/1440px), claro e escuro, sobre os blocos de design compartilhados e as telas mais críticas;
- suíte de testes, lint, typecheck e build limpos após as correções;
- nenhuma credencial ou dado real versionado.

## Não incluído

- qualquer funcionalidade de produto nova;
- dependências novas;
- varredura exaustiva de todas as ~20 telas em 4 breakpoints × 2 temas (160 capturas).

## Risco de governança conhecido

A FIT-003 (#4, proteção técnica da `main`) continua tratada conforme o estado real do repositório — `main` permanece `"protected": false`. A disciplina de branch/checkpoint permanece a única salvaguarda efetiva.
