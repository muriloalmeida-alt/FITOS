# Diário de execução — Conclusão integral do MVP

Este documento registra a execução do pacote único enviado por Murilo em 20/09/2026 (`FitOS_Pacote_Unico_Execucao_Integral_Claude_v3.zip`, arquivo de entrada `PROMPT_MESTRE.md`). Substitui, para este programa, o modelo de "um PR/merge por História" usado até a SPRINT-06 e o início da SPRINT-07 (FIT-030/FIT-031, já mergeadas antes deste pacote): a partir daqui, todo o trabalho ocorre em uma única branch (`feat/conclusao-integral-mvp`), com commits/checkpoints por História, sem PR nem merge intermediário, até um único PR final marcado **PRONTO PARA REVISÃO GPT/CODEX — NÃO MERGEAR**.

## Checklist de leitura — 36 arquivos Markdown do pacote

Todos os 36 arquivos foram lidos integralmente antes de qualquer alteração de código nesta branch. Os 22 arquivos em `referencias-canonicas/` foram também comparados byte a byte com a versão correspondente em `docs/` na `main` (commit `a5b7fc5`) — todos idênticos, confirmando que o pacote não alterou nenhuma decisão canônica já registrada no repositório, apenas a governança de execução/merge deste programa.

| # | Arquivo | Lido | Idêntico à `main`? |
|---:|---|---|---|
| 1 | `PROMPT_MESTRE.md` | ✅ | — (arquivo novo do pacote) |
| 2 | `README.md` (do pacote) | ✅ | — (arquivo novo do pacote) |
| 3 | `01_ESTADO_ATUAL.md` | ✅ | — (arquivo novo do pacote) |
| 4 | `02_PLANO_EXECUCAO_TOTAL.md` | ✅ | — (arquivo novo do pacote) |
| 5 | `03_SPRINT_07_TREINOS_E_PLANOS.md` | ✅ | — (arquivo novo do pacote) |
| 6 | `04_SPRINT_08_EXPERIENCIA_ALUNO.md` | ✅ | — (arquivo novo do pacote) |
| 7 | `05_SPRINT_09_FINANCEIRO.md` | ✅ | — (arquivo novo do pacote) |
| 8 | `06_SPRINT_10_PAINEL_OPERACIONAL.md` | ✅ | — (arquivo novo do pacote) |
| 9 | `07_SPRINT_11_CONSOLIDACAO_VISUAL_RELEASE.md` | ✅ | — (arquivo novo do pacote) |
| 10 | `08_CONTRATO_VISUAL_OBRIGATORIO.md` | ✅ | — (arquivo novo do pacote) |
| 11 | `09_GOVERNANCA_PR_E_MERGE.md` | ✅ | — (arquivo novo do pacote) |
| 12 | `10_HANDOFF_PARA_REVISAO.md` | ✅ | — (arquivo novo do pacote) |
| 13 | `11_CHECKLIST_APROVACAO_GPT_CODEX.md` | ✅ | — (arquivo novo do pacote) |
| 14 | `12_HOMOLOGACAO_E_RELEASE.md` | ✅ | — (arquivo novo do pacote) |
| 15 | `referencias-canonicas/governanca/ROADMAP.md` | ✅ | Idêntico |
| 16 | `referencias-canonicas/governanca/DEFINITION-OF-DONE.md` | ✅ | Idêntico |
| 17 | `referencias-canonicas/governanca/GOVERNANCA.md` | ✅ | Idêntico |
| 18 | `referencias-canonicas/design/PRODUCT-DESIGN.md` | ✅ | Idêntico |
| 19 | `referencias-canonicas/design/RESEARCH-AND-TESTING-PLAN.md` | ✅ | Idêntico |
| 20 | `referencias-canonicas/design/M3-DESIGN-TOKENS.md` | ✅ | Idêntico |
| 21 | `referencias-canonicas/design/COMPONENT-LIBRARY.md` | ✅ | Idêntico |
| 22 | `referencias-canonicas/design/BENCHMARK-IDENTIDADE-VISUAL.md` | ✅ | Idêntico |
| 23 | `referencias-canonicas/design/DESIGN-GOVERNANCE.md` | ✅ | Idêntico |
| 24 | `referencias-canonicas/design/UX-ARCHITECTURE.md` | ✅ | Idêntico |
| 25 | `referencias-canonicas/design/CRITICAL-SCREEN-SPECS.md` | ✅ | Idêntico |
| 26 | `referencias-canonicas/engenharia/VISAO-ARQUITETURAL.md` | ✅ | Idêntico |
| 27 | `referencias-canonicas/engenharia/OBSERVABILIDADE.md` | ✅ | Idêntico |
| 28 | `referencias-canonicas/engenharia/EXECUCAO-LOCAL.md` | ✅ | Idêntico |
| 29 | `referencias-canonicas/engenharia/ESTRATEGIA-DE-TESTES.md` | ✅ | Idêntico |
| 30 | `referencias-canonicas/engenharia/SEGURANCA-E-LGPD.md` | ✅ | Idêntico |
| 31 | `referencias-canonicas/engenharia/TREINOS-E-PLANOS.md` | ✅ | Idêntico |
| 32 | `referencias-canonicas/backlog/SPRINT-07-TREINOS-E-PLANOS.md` | ✅ | Idêntico |
| 33 | `referencias-canonicas/backlog/EPIC-06-TREINOS-E-PLANOS.md` | ✅ | Idêntico |
| 34 | `referencias-canonicas/backlog/BACKLOG-MVP.md` | ✅ | Idêntico |
| 35 | `referencias-canonicas/produto/PRD-01-MVP.md` | ✅ | Idêntico |
| 36 | `referencias-canonicas/produto/REGRAS-DE-NEGOCIO.md` | ✅ | Idêntico |

Total: 36 arquivos Markdown encontrados no pacote — corresponde exatamente ao número declarado em `PROMPT_MESTRE.md`, sem divergência a registrar. Além dos 36, o pacote inclui `referencias-visuais/FITOS_REFERENCIA_OFICIAL.jpeg` (não Markdown), também analisada.

## Baseline revalidada antes da execução

- `main` no momento da leitura: `a5b7fc5` — exatamente o commit declarado em `01_ESTADO_ATUAL.md`. Nenhum avanço desde então; nenhuma matriz de estado a atualizar por esse motivo.
- FIT-030 e FIT-031 confirmadas mergeadas (PRs #56/#58, mais os PRs documentais #57/#59 de auto-referência).
- Issues #52 (FIT-030) e #53 (FIT-031) já fechadas pelo merge; Issues #54 (FIT-032) e #55 (FIT-033) abertas, sob EPIC-06 (#51)/SPRINT-07.
- Nenhum PR aberto conflitante; nenhuma branch de trabalho concorrente.
- Railway: `railway whoami` sem sessão autenticada nesta execução — mesma pendência de acesso já registrada em todas as Sprints anteriores. Não foi criado projeto/banco paralelo. A homologação canônica (`fitos-web-hml`/`fitos-postgres-hml`, `hml-fitos.up.railway.app`) não foi tocada nem redirecionada para esta branch, conforme exigido.
- `API_NINJAS_KEY`/`API_NINJAS_API_KEY`: nenhuma chave nova disponível nesta sessão. A chave mencionada em conversa anterior a este pacote permanece tratada como exposta e nunca é usada, recuperada, transcrita ou registrada. Decisão de licença/plano comercial continua não confirmada — importação real do catálogo global permanece uma pendência declarada, não um bloqueio para o restante do programa.

## Governança adotada a partir deste ponto (substitui o modelo anterior)

Conforme `PROMPT_MESTRE.md` e `09_GOVERNANCA_PR_E_MERGE.md`:

- uma única branch de programa: `feat/conclusao-integral-mvp`, criada a partir da `main` atualizada (`a5b7fc5`);
- commits pequenos e rastreáveis por História, prefixados por `[FIT-XXX]`;
- nenhum PR intermediário; nenhum merge antes da aprovação externa;
- ao final de cada História: commit/checkpoint, gate autônomo, registro de resultado nesta seção;
- ao final de todo o programa (SPRINT-07 a SPRINT-11): gate final integral, um único PR final, seção de handoff no formato de `10_HANDOFF_PARA_REVISAO.md`, comentário `STATUS: PRONTO PARA REVISÃO GPT/CODEX — NÃO MERGEAR.`, e parada — sem aprovar ou mergear o próprio PR.

## Decisão registrada — nome da variável da API Ninjas

`PROMPT_MESTRE.md` e `01_ESTADO_ATUAL.md` mencionam a variável como `API_NINJAS_KEY`; todo o código, testes e documentação já mergeados na FIT-020 (`src/integrations/api-ninjas/client.ts`, `.env.example`, ADR-004) usam `API_NINJAS_API_KEY`. Questão levada a Murilo antes de agir (decisão de nomenclatura em código de segurança não deveria ser um palpite): confirmado manter `API_NINJAS_API_KEY` — a menção no pacote é tratada como imprecisão de memória, não uma decisão deliberada de renomear. Nenhum código alterado por esse motivo.

## Gate preliminar — auditoria do catálogo local de exercícios (FIT-020 a FIT-023)

Executado conforme `02_PLANO_EXECUCAO_TOTAL.md` ("Gate preliminar — catálogo local de exercícios") antes de concluir Treinos e Planos.

1. **Leitura funcional usa somente PostgreSQL local**: confirmado — `listCatalogExercises`/`getCatalogExerciseForTenant` (FIT-023) e o builder de modelo de treino (FIT-030, `addWorkoutExercise` → `getCatalogExerciseForTenant`) nunca chamam `searchExercises`/a API Ninjas; consultam exclusivamente o Postgres. Nenhuma chamada síncrona à API externa em nenhuma tela de personal.
2. **Sincronização backend idempotente**: `importGlobalExercises`/`upsertGlobalExercise` (FIT-021) já implementam upsert idempotente por `[origin, externalId]`, com contagens de recebidos/válidos/criados/atualizados/rejeitados/buscas com falha — comprovado por teste de concorrência real (duas importações simultâneas do mesmo exercício nunca duplicam).
3. **Dedup, atualização, falha externa, timeout, ausência de credencial**: todos cobertos por testes já existentes (`client.test.ts`, `importExercises.integration.test.ts`) — nenhum reteste necessário, nenhuma regressão introduzida por este pacote.
4. **Nenhuma chamada externa por navegação/busca**: confirmado no item 1.
5. **Exercícios importados continuam disponíveis sem a API**: por construção — a leitura nunca depende da API estar no ar (item 1); não há dependência de rede na consulta.
6. **Homologação com carga real**: não realizada — ausência de chave nova/licença confirmada (pendência já declarada desde a SPRINT-06, mantida).
7. **Métricas da última sincronização**: `importGlobalExercises` retorna as contagens da própria chamada; não existe hoje um campo dedicado de "data da última sincronização" no schema — `Exercise.updatedAt` cobre esse propósito na prática (toda escrita de sincronização atualiza esse campo). Registrado como equivalente funcional, não uma lacuna a corrigir agora.

**Gap identificado e deliberadamente não implementado nesta rodada**: `PROMPT_MESTRE.md` pede "periodicidade configurável" de sincronização. O que existe (`npm run import:exercises`, comando manual único) atende "sincronização manual administrativa", mas não uma infraestrutura de agendamento configurável (cron/config de intervalo). Construir essa infraestrutura agora seria especulativo — não há chave/licença que a torne executável, e nenhuma Issue original (FIT-020 a FIT-023) pedia agendamento. Registrado como pendência explícita para decisão futura de Produto, não implementado por precaução contra complexidade sem uso real (mesmo princípio já aplicado em Sprints anteriores: nunca presumir autorização de uso comercial nem investir em infraestrutura que só teria sentido com uma chave que não existe).

**Conclusão do gate**: FIT-020 a FIT-023 permanecem corretas e nada foi reimplementado. Nenhuma migration nova. Nenhuma regressão. A pendência de importação real (chave/licença) permanece exatamente como declarada no fechamento da SPRINT-06.

## Checkpoints por História

Preenchido incrementalmente. Cada linha é adicionada ao concluir a História correspondente, com o SHA do commit/checkpoint (não um PR).

| História | Commit/checkpoint | Resultado do gate | Observações |
|---|---|---|---|
| FIT-032 | `d0b39f7` | **Aprovado** — 389/389 testes, lint/typecheck/build/audit limpos; migration testada em banco vazio e em atualização do schema atual; evidência visual 12 capturas (mobile+desktop, claro+escuro) validadas uma a uma | Continuação do trabalho já iniciado nesta sessão antes da chegada do pacote. Bug real encontrado e corrigido durante a evidência (plano rascunho identificado por heurística) — ver `TREINOS-E-PLANOS.md`. Gate preliminar de auditoria FIT-020 a FIT-023 executado no mesmo checkpoint. |
| FIT-033 | `00fdf40` | **Aprovado** — 415/415 testes (11 novos de integração + 7 de rota + 8 de página), lint/typecheck/build/audit limpos; migration testada em banco vazio e em atualização do schema atual; evidência visual 8 capturas (mobile+desktop, claro+escuro) validadas uma a uma, incluindo a prova de imutabilidade (editar o modelo original depois da atribuição não altera o que o aluno vê) | Materializa a ADR-005 (versionamento por cópia física), preparada desde a FIT-030/031 mas não usada até agora. Encerra a SPRINT-07 — a Sprint só é considerada de fato encerrada após a aprovação do PR final do programa por GPT/Codex, não por este checkpoint. |
| FIT-040 | `f51c91d` | **Aprovado** — 426/426 testes (6 novos de integração + 5 de `AlunoHome.test.tsx` + 1 caso atualizado em `page.test.tsx`), lint/typecheck/build/audit limpos; nenhuma migration; evidência visual 6 capturas (mobile+desktop, claro+escuro) validadas uma a uma, cobrindo os quatro estados | Primeira História da SPRINT-08 (EPIC-07). Decisão de design registrada (algoritmo de "hoje") — ver `EXPERIENCIA-DO-ALUNO.md`. |
| FIT-041 | `72bad67` | **Aprovado** — 479/479 testes (16 novos de integração + 16 de rota + 12 de componente + 6 de página), lint/typecheck/build/audit limpos; migration testada em banco vazio e em atualização do schema atual; evidência visual 8 capturas (mobile+desktop, claro+escuro) validadas uma a uma, incluindo retomar sessão com resultado preservado | Primeira implementação real de `src/modules/execution/` (reservado desde a FIT-007). Decisões de escopo registradas (PLANEJADA nunca produzido; "repetir prescrito"; sem AuditEvent para sessão) — ver `EXPERIENCIA-DO-ALUNO.md`. |
| FIT-042 | `fb866c0` | **Aprovado** — 507/507 testes (8 novos de integração + 8 de rota + 5 de `AvaliacoesSection.test.tsx` + 5 de `ProgressoPage`/`page.test.tsx` da ficha do aluno), lint/typecheck/build/audit limpos; migration testada em banco vazio e em atualização do schema atual; evidência visual 8 capturas (mobile+desktop, claro+escuro) validadas uma a uma, incluindo a exclusão lógica refletida imediatamente em ambos os lados | Primeira implementação real de `src/modules/evolution/` (reservado desde a FIT-007). Encerra a SPRINT-08 — a Sprint só é considerada de fato encerrada após a aprovação do PR final do programa por GPT/Codex, não por este checkpoint. Decisões de escopo registradas (conjunto fechado de medidas; unidade fixa em cm; sem edição; sem fotografias) — ver `EXPERIENCIA-DO-ALUNO.md`. |
| FIT-050 | `871ac8e` | **Aprovado** — 534/534 testes (8 novos de integração em `charges.integration.test.ts` + 10 de rota + 5 de `FinanceiroSection.test.tsx` + 3 de `page.test.tsx` do financeiro), lint/typecheck/build limpos; migration testada em banco vazio e em atualização do schema atual (com backfill das 2 linhas sintéticas do seed original da FIT-007); evidência visual 4 capturas (mobile+desktop, claro+escuro) validadas uma a uma, incluindo a transição real `pendente` → `atrasado` | Primeira implementação real de `src/modules/student-finance/` (reservado desde a FIT-007). Cancelamento de cobrança agrupado nesta História (nenhuma FIT separada o reivindica). Migration única cobre FIT-050 e FIT-051 (`Payment` depende da extensão de `StudentCharge`) — decisão registrada em `FINANCEIRO.md`. |
| FIT-051 | `31a968f` | **Aprovado** — 544/544 testes (3 novos de integração incluindo a defesa física contra segundo pagamento + 5 de rota + 2 de `FinanceiroSection.test.tsx`), lint/typecheck/build limpos; nenhuma migration nova (tabela `payments` já existia desde a FIT-050); evidência visual 3 capturas (mobile+desktop, claro+escuro) validadas uma a uma | `registerPayment` grava `Payment`, marca a cobrança `pago` e registra `AuditEvent` (`PAGAMENTO_REGISTRADO`) na mesma transação. Decisões de escopo (pagamento parcial fora do MVP; ações mutuamente exclusivas na UI) registradas em `FINANCEIRO.md`. |
| FIT-052 | `7ca8e4f` | **Aprovado** — 566/566 testes (5 novos de integração incluindo a defesa física contra geração duplicada da mesma competência + 11 de rota + 5 de `RecorrenciasSection.test.tsx` + 1 de `page.test.tsx` do financeiro), lint/typecheck/build limpos; migration testada em banco vazio e em atualização do schema atual; evidência visual 4 capturas (mobile+desktop, claro+escuro) validadas uma a uma, incluindo a prova de que encerrar a recorrência nunca afeta lançamentos já gerados | `ChargeRecurrence`/`generateNextChargeForRecurrence` geram lançamentos físicos independentes por competência, nunca uma referência viva. Sem infraestrutura de agendamento (mesma decisão da FIT-020/023) — geração é sempre ação explícita. Decisões de escopo registradas em `FINANCEIRO.md`. |
| FIT-053 | `7d9b927` | **Aprovado** — 569/569 testes (2 novos de integração + 1 de `page.test.tsx` do financeiro), lint/typecheck/build limpos; nenhuma migration nova; evidência visual 4 capturas (mobile+desktop, claro+escuro) validadas uma a uma, incluindo o filtro de competência honesto (mês sem lançamento nunca mistura dados de outro mês) | Encerra a SPRINT-09 — a Sprint só é considerada de fato encerrada após a aprovação do PR final do programa por GPT/Codex, não por este checkpoint. `getFinancialSummary` soma por competência, sempre precedida por `refreshOverdueCharges`. Decisões de escopo registradas em `FINANCEIRO.md`. |
| FIT-060 | `e9ffce8` | **Aprovado** — 572/572 testes (1 novo de `page.test.tsx` do painel + 2 novos de `PersonalHome.test.tsx`), lint/typecheck/build limpos; nenhuma migration nova; evidência visual 4 capturas (mobile+desktop, claro+escuro) validadas uma a uma, incluindo a consistência entre o indicador do Início e a tela de financeiro completa | Encerra a SPRINT-10 (e a Fase 6 do roadmap) — a Sprint só é considerada de fato encerrada após a aprovação do PR final do programa por GPT/Codex. Nenhuma entidade nova — composição sobre `listStudents`/`listWorkoutsForTenant`/`getFinancialSummary` já isolados por tenant. Decisões de escopo registradas em `PAINEL-OPERACIONAL.md`. |
| FIT-070 | `fc2d582` | **Aprovado** — 573/573 testes (1 novo em `Button.test.tsx` provando que a variante `href` nunca aninha um `<button>` dentro de um `<a>`), lint/typecheck/build limpos; nenhuma migration; evidência visual 32 capturas (4 telas × 4 breakpoints × 2 temas) validadas uma a uma, incluindo a autocorreção de uma regressão visual (sublinhado indevido) encontrada durante a própria captura desta História | Encerra a SPRINT-11, o EPIC-10 e o programa de execução integral (SPRINT-07 a SPRINT-11). Dois achados reais corrigidos: `Button` sem indicador de foco visível (SC 2.4.7); `<button>` aninhado dentro de `<a>` em 8 pontos da aplicação (HTML inválido, desde a FIT-013). Contraste AA de todos os tokens M3 comprovado matematicamente. Nota de transparência sobre a origem reconstruída desta Sprint (arquivos de entrada do pacote original não persistidos neste repositório) registrada em `EPIC-10-CONSOLIDACAO-VISUAL-RELEASE.md`. Decisões e achados completos em `ACESSIBILIDADE-E-CONSOLIDACAO-VISUAL.md`. |

## SPRINT-08 — Experiência do Aluno (formalização)

Sem pausa entre Sprints, conforme mandato do pacote. Formalizados: EPIC-07 (#60), FIT-040 (#61), FIT-041 (#62), FIT-042 (#63) — `docs/04-backlog/EPIC-07-EXPERIENCIA-DO-ALUNO.md`, `docs/05-sprints/SPRINT-08-EXPERIENCIA-DO-ALUNO.md`, `docs/00-governanca/ROADMAP.md` (Fase 4) atualizados. Issues criadas via GitHub MCP no estado real ("Não iniciada"/critérios não marcados) — **correção registrada aqui**: a primeira escrita da Issue #61 (FIT-040) foi por engano publicada já como "Concluída" com os critérios marcados, antes de qualquer código existir; corrigida na mesma sessão, antes de qualquer outra ação, para o estado real ("Não iniciada"). Registrado por transparência, não por ser um erro de dado de produto — nenhum código foi afetado.

**Erro adicional encontrado e corrigido durante a redação do EPIC-07**: a primeira versão do documento citou entre aspas, como se fossem texto literal de `docs/01-produto/REGRAS-DE-NEGOCIO.md`, frases que na verdade eram minha própria paráfrase ("Aluno registra execução real...", "Sessão de treino não pode ser criada...", "Avaliações físicas seguem regras de LGPD..."). Verificação linha a linha contra o arquivo real antes de prosseguir mostrou que o texto verdadeiro é outro (seções 6/7/9: "Estados: `planejada`, `em_andamento`, `concluida` e `abandonada`", "O histórico de execução não pode ser recalculado após mudança do plano", "Fotografias são opcionais e exigem autorização explícita do aluno", etc.). Corrigido antes de qualquer commit — nenhuma citação fabricada chegou a ser versionada. Registrado como lembrete operacional: sempre ler o arquivo-fonte antes de citá-lo entre aspas, mesmo quando o conteúdo parece previsível.

**Decisão de design registrada — os quatro estados da tela "Hoje" (FIT-040)**: nem `PROMPT_MESTRE.md` nem `CRITICAL-SCREEN-SPECS.md` especificam o algoritmo exato de "próximo treino". Interpretação adotada, documentada aqui para revisão externa: dado o vocabulário fixo de `suggestedDays` já usado na UI do personal desde a FIT-030 (`SEGUNDA`/`TERCA`/`QUARTA`/`QUINTA`/`SEXTA`/`SABADO`/`DOMINGO`), a tela "Hoje" busca, entre os modelos do plano atribuído (na ordem de posição), o primeiro cujo `suggestedDays` inclua o dia da semana atual (hora do servidor — mesma simplificação de fuso já aceita em `daysUntil`, FIT-015). Se nenhum modelo tiver esse dia — inclusive quando nenhum modelo tem `suggestedDays` configurado — o estado é "descanso". "Treino futuro" é lido literalmente: o treino encontrado para hoje ainda não foi executado (não existe registro de sessão até a FIT-041) — não é um estado de "próximo dia da semana com treino", que exigiria um motor de agendamento fora do escopo do MVP (`EPIC-07`, "Fora do escopo"). Se dois modelos do mesmo plano tiverem o mesmo dia configurado, o primeiro por posição vence — limitação aceita, não uma regra de negócio pedida por nenhum documento.

## SPRINT-09 — Gestão Financeira (formalização)

Sem pausa entre Sprints, conforme mandato do pacote. Formalizados: EPIC-08 (#64), FIT-050 (#66), FIT-051 (#67), FIT-052 (#68), FIT-053 (#69), EPIC-09 (#65), FIT-060 (#70) — `docs/04-backlog/EPIC-08-FINANCEIRO.md`, `docs/04-backlog/EPIC-09-PAINEL-OPERACIONAL.md`, `docs/05-sprints/SPRINT-09-GESTAO-FINANCEIRA.md`, `docs/05-sprints/SPRINT-10-PAINEL-OPERACIONAL.md`, `docs/00-governanca/ROADMAP.md` (Fases 5/6) atualizados. Issues criadas via GitHub MCP já no estado real ("Não iniciada"/critérios não marcados) desde o primeiro registro — nenhuma correção necessária desta vez.

**Decisão de design registrada — "atrasado" é persistido, "a vencer" não é (FIT-050)**: `REGRAS-DE-NEGOCIO.md` seção 8 lista `pendente`/`pago`/`atrasado`/`cancelado` como os quatro estados persistidos, mas `CRITICAL-SCREEN-SPECS.md` seção 7 e o README de `src/modules/student-finance/` (desde a FIT-007) dizem que "a vencer" é só apresentação calculada. Sem infraestrutura de agendamento (mesma decisão da FIT-020/023), a transição real `pendente` → `atrasado` é aplicada por `refreshOverdueCharges`, chamada de forma auto-contida no início de toda leitura agregada (nunca por um job em segundo plano) — idempotente, escopada por tenant. "A vencer" continua sendo resolvido só na UI, nunca no domínio, nunca escrito.

**Decisão de escopo registrada — cancelamento de cobrança agrupado na FIT-050**: nenhuma História do backlog original (FIT-050 a FIT-053) reivindica a ação de cancelar uma cobrança, apesar de `cancelado` ser um dos quatro estados da regra de negócio. Como é o contraponto direto do ciclo de vida da cobrança recém-criada, foi implementado junto com a FIT-050, e registrado explicitamente aqui e na Issue #66 para transparência com a revisão externa.

**Decisão de escopo registrada — `Payment` chega no schema da FIT-050, mas só é usado na FIT-051**: `Payment` depende diretamente da extensão de `StudentCharge` feita na FIT-050 (mesma migration, `20260921000000_add_student_charge_and_payment`) — dividir em duas migrations sequenciais não agregaria nada, já que as duas Histórias chegam no mesmo checkpoint de mudança de schema. A tabela existe desde a FIT-050 mas permanece sem nenhuma linha até o código da FIT-051 ser escrito.

## SPRINT-10 — Painel Operacional

Sem pausa entre Sprints, conforme mandato do pacote. EPIC-09 (#65) e FIT-060 (#70) já haviam sido formalizados no mesmo lote da SPRINT-09 (ver seção acima); nenhuma formalização adicional foi necessária ao iniciar esta Sprint.

**Decisão de escopo registrada — isolamento herdado, não re-testado (FIT-060)**: `PersonalHome.tsx` não escreve nenhuma consulta nova — compõe `listStudents` (FIT-013), `listWorkoutsForTenant` (FIT-030) e `getFinancialSummary` (FIT-053), cada uma já comprovada por teste de isolamento real na sua própria História. Escrever um novo teste de isolamento para FIT-060 duplicaria exatamente o que essas três Histórias já provam, sem exercitar nenhum código novo — a suíte de `page.test.tsx`/`PersonalHome.test.tsx` desta História testa composição e exibição, não isolamento (que já é garantia física das funções reutilizadas). Registrado por transparência: esta é uma decisão deliberada, não uma lacuna de cobertura.

## SPRINT-11 — Consolidação Visual e Release

Sem pausa entre Sprints, conforme mandato do pacote. Formalizados EPIC-10 (#71) e FIT-070 (#72) — `docs/04-backlog/EPIC-10-CONSOLIDACAO-VISUAL-RELEASE.md`, `docs/05-sprints/SPRINT-11-CONSOLIDACAO-VISUAL-RELEASE.md`, `docs/00-governanca/ROADMAP.md` (Fase 7, última Fase do MVP) atualizados.

**Nota de transparência registrada — origem desta Sprint reconstruída, não copiada**: os arquivos de entrada do pacote original `07_SPRINT_11_CONSOLIDACAO_VISUAL_RELEASE.md` e `08_CONTRATO_VISUAL_OBRIGATORIO.md` existiram apenas no contexto de uma sessão anterior a esta continuação e não foram persistidos neste repositório — seu texto exato não está disponível. Em vez de inventar o conteúdo, o escopo da FIT-070 foi reconstruído a partir de documentação que É versionada no repositório (`ROADMAP.md`, `M3-DESIGN-TOKENS.md`, `CRITICAL-SCREEN-SPECS.md`), sinalizado explicitamente em `EPIC-10-CONSOLIDACAO-VISUAL-RELEASE.md`, `SPRINT-11-CONSOLIDACAO-VISUAL-RELEASE.md` e na Issue #71 para julgamento da revisão externa.

**Auditoria de acessibilidade sem dependência nova**: contraste WCAG 2.2 AA de todos os pares texto/fundo dos tokens M3 comprovado por script Node de fórmula de luminância relativa/razão de contraste escrito à mão (sem adicionar `axe-core` ou equivalente) — todos os pares passam com folga (mínimo 6,37:1 claro, 7,19:1 escuro, acima do limiar 4.5:1). Detalhe completo, incluindo os dois bugs reais corrigidos (`Button` sem foco visível; `<button>` aninhado em `<a>` em 8 pontos desde a FIT-013) e o julgamento de escopo sobre `outlineVariant` no `AppShell`, em `ACESSIBILIDADE-E-CONSOLIDACAO-VISUAL.md`.

**Encerra a SPRINT-11, o EPIC-10 e o programa de execução integral (SPRINT-07 a SPRINT-11)** — a Sprint, o Epic e o programa só são considerados de fato encerrados após a aprovação do PR final por GPT/Codex, não por este checkpoint.

## Fechamento do programa integral

Gate final revalidado no HEAD da branch (`34c61c8`, checkpoint FIT-070) imediatamente antes da abertura do PR único: `npx tsc --noEmit` sem erros; `npm run test` → 573/573 testes (96 arquivos); `npm run lint` limpo; `npm run build` completo, todas as rotas registradas; `npm audit --production` → 0 vulnerabilidades. `git fetch origin main` + `git merge-base origin/main feat/conclusao-integral-mvp` confirmam `origin/main` ainda em `a5b7fc5`, exatamente o merge-base — nenhuma sincronização necessária antes do PR final.

Handoff completo para a revisão externa (resumo do programa, tabela de checkpoints, Issues, decisões de escopo, riscos e pendências declarados) redigido em `docs/06-engenharia/10-HANDOFF-PARA-REVISAO.md` (commit `b966f4a`), com nota de transparência própria sobre a reconstrução do template original `10_HANDOFF_PARA_REVISAO.md` (não persistido neste repositório).

PR único do programa aberto a partir de `feat/conclusao-integral-mvp` contra `main`: **PR #73** — https://github.com/muriloalmeida-alt/FITOS/pull/73 — encerrando com o comentário literal exigido pela governança: `STATUS: PRONTO PARA REVISÃO GPT/CODEX — NÃO MERGEAR.`. Este PR não foi aprovado nem mergeado por quem o abriu — decisão exclusiva da revisão externa e/ou do Product Owner.

## Correções pós-abertura do PR #73 (pedidas pela revisão externa)

Duas correções solicitadas sobre o PR/handoff, ambas aplicadas antes de qualquer aprovação/merge (commit `c618345`):

1. **Classificação de privacidade/LGPD corrigida**: a linha "Segurança e privacidade: não" do PR estava incompleta — o programa introduziu dados corporais (peso, % de gordura, medidas — FIT-042), tratados aqui como potencialmente sensíveis nos termos do art. 5º, II da LGPD ("dado referente à saúde"), e dados financeiros (FIT-050 a FIT-053). Corrigida para "sim", com detalhamento dos controles já vigentes (acesso autenticado/isolado por tenant, `AuditEvent` para exclusão de avaliação e para pagamento) em `10-HANDOFF-PARA-REVISAO.md`, seção "Correções aplicadas após revisão externa". Confirmação jurídica formal da classificação permanece pendência declarada em `DECISOES-PENDENTES.md`, não alterada por esta correção.
2. **Gate automatizado adicionado**: `.github/workflows/ci.yml` — até então não havia nenhum workflow de CI no repositório, e "573/573 testes com PostgreSQL" era apenas uma afirmação desta sessão, sem meio de reprodução independente. O workflow sobe um serviço PostgreSQL 16 real, aplica as 15 migrations do zero e executa typecheck/lint/test/build/audit a cada push/PR. Validado localmente antes do commit: banco `fitos_test` zerado, migrations reaplicadas do zero, sequência completa do workflow executada com as mesmas variáveis de ambiente do job — 573/573 testes, typecheck/lint/build limpos, 0 vulnerabilidades, idêntico ao gate já registrado nos checkpoints.

PR #73 atualizado (título/descrição) para refletir ambas as correções.

## Redesign "Evolução em movimento" (EPIC-11)

Após o merge do PR #73, o Product Owner reportou que o visual do MVP não refletia o conceito de marca planejado. Recebido o pacote `FitOS_Pacote_Implementacao_Redesign_MVP_v1` (v1.0, aprovado por Produto) com a direção visual, os componentes/tokens, o inventário de telas e os ativos de mídia oficiais. Detalhamento completo em `docs/04-backlog/EPIC-11-REDESIGN-EVOLUCAO-EM-MOVIMENTO.md`.

Executado em 4 Lotes, todos mergeados na `main`:

- **Lote A** (fundação): chrome navy no `AppShell`, componente `PulseLine`, hero de login — PRs #75, #81.
- **Lote B** (Personal): editorial "Sua equipe está em movimento" no Início, avatar por iniciais em Alunos — PRs #82, #83.
- **Lote C** (Aluno): destaque teal ("Flow Teal") na evolução de peso do Progresso — PR #84.
- **Lote D** (consolidação): decisão registrada sobre mídia de exercícios (não vinculada — sem campo de imagem no schema e heurística de nome descartada por risco) e varredura de regressão/responsividade — PR #85.

EPIC-11 (#76) e todas as Histórias (FIT-081 a FIT-084) fechados. Pendência declarada, fora deste Epic: vínculo de imagens por exercício depende de decisão de Produto (campo de imagem no schema, própria migration).

## Teste de disparo de deploy no Railway

Registrado a pedido do Product Owner: após os 6 merges do EPIC-11 na `main`, o painel do Railway mostrava como último deploy apenas o do PR #73 (2h antes), sem nenhum novo deploy disparado pelos merges seguintes — indicando que o redeploy automático a partir de `main` não está disparando a cada push (ou nunca foi configurado para isso). Esta entrada em si é o commit de teste para o Product Owner confirmar, no painel do Railway, se um novo push em `main` dispara um novo deploy.

## Pacote pós-MVP: Monetização (2.1) e FitOS Livre (2.2)

Recebido `FitOS_Pacote_Pos_MVP_Fases_2_1_Monetizacao_2_2_Livre_v3` (Murilo Almeida, 21/09/2026) — 17 documentos + `PROMPT_MESTRE.md` + referências visuais, lidos integralmente antes de qualquer código. Duas fases: **2.1 Monetização** (assinatura SaaS do personal, Asaas candidato) e **2.2 FitOS Livre** (produto B2C), com pré-requisito operacional `IMP-EX-001` (carga única do catálogo via API Ninjas — não é História FIT).

**Colisão de numeração identificada antes de qualquer Issue**: o pacote reserva `FIT-070` a `FIT-089`, faixa já usada por Issues fechadas e não relacionadas (`FIT-070` = SPRINT-11/EPIC-10; `FIT-080`-`FIT-084` = Lotes A-D do EPIC-11). Verificação feita diretamente no GitHub (`list_issues`/`search_issues`) antes de qualquer formalização. Decisão de Murilo: renumerar para `FIT-090`-`FIT-099` (EPIC-12 — Monetização) e `FIT-100`-`FIT-109` (EPIC-13 — FitOS Livre), preservando integralmente conteúdo e ordem do pacote. Detalhe completo em `docs/04-backlog/EPIC-12-MONETIZACAO.md` e `EPIC-13-FITOS-LIVRE.md`.

**Novo gate de governança** a partir deste pacote: todo PR permanece `PRONTO PARA REVISÃO GPT/CODEX — NÃO MERGEAR` até aprovação explícita de revisão externa (GPT/Codex) **e** aceite de Produto — diferente do EPIC-11, onde bastava o aceite de Produto.

### IMP-EX-001 — implementado (branch `feature/imp-ex-001-importacao-catalogo`)

Pré-requisito operacional executado primeiro, por decisão de Murilo. A infraestrutura de importação já existia desde a FIT-021 (`importGlobalExercises`, client isolado da API Ninjas, upsert idempotente por `externalId` determinístico) — nunca foi usada de verdade, por falta de chave válida (ADR-004). Esta rodada adiciona exatamente o que faltava para a carga única formal:

- `CatalogImportRun` (migration `20260921161719_add_catalog_import_run`): trilha `PENDING → RUNNING → COMPLETED|FAILED`, com dois índices únicos parciais em `(provider, environment)` — um `WHERE status = 'RUNNING'` (trava de concorrência) e outro `WHERE status = 'COMPLETED'` (bloqueio de segunda carga) — adicionados à mão na migration, mesmo padrão dos TRIGGERs de tenant já existentes.
- `catalogImportManifest.ts`: manifesto versionado (`v1-muscle-groups`, os mesmos 10 grupos musculares documentados desde a FIT-021/ADR-004) e hash determinístico — dimensões `type`/`difficulty`/`equipments` deliberadamente fora por não terem enumeração confirmada por consulta independente (acesso a `api-ninjas.com`, a documentação, continua bloqueado pelo proxy de egresso).
- `catalogImportRun.ts`: `startCatalogImportRun` (cria, bloqueia concorrência/segunda carga, ou retoma um `FAILED` do mesmo manifesto), `advanceCatalogImportRun` (checkpoint + contadores incrementais), `completeCatalogImportRun`, `failCatalogImportRun`.
- `scripts/import-exercicios.ts` reescrito (mesmo arquivo, renomeado de `npm run import:exercises` para `npm run catalog:import-api-ninjas`): exige `--environment=homologacao|producao`; `--dry-run` valida credencial/contrato/volume com chamada real de leitura, sem gravar nada; produção exige `--autorizar-producao` além de `--autorizado-por`; reimportação após `COMPLETED` exige `--force-reimport --justificativa=...`; retomada de um `FAILED` é automática (mesmo comando, sem flag nova), desde que o manifesto seja idêntico.
- **Achado de conectividade, verificado nesta rodada**: `api.api-ninjas.com` (o endpoint da API) é alcançável a partir deste ambiente de execução — diferente de `api-ninjas.com` (a documentação, bloqueada pelo proxy). Testado com `--dry-run` e uma chave deliberadamente inválida: 403 real nas 10 consultas do manifesto, confirmando o client ponta a ponta contra a rede real. `API_NINJAS_API_KEY` continua sem valor real neste ambiente — nenhuma importação real foi executada. Atualização registrada em ADR-004.
- Testes novos: `catalogImportManifest.test.ts` (determinismo do hash), `catalogImportRun.integration.test.ts` (trava de concorrência real via `Promise.allSettled`, bloqueio de segunda carga, reimportação forçada com justificativa, retomada preservando checkpoint/contadores, recusa de retomada com manifesto divergente). Suíte completa revalidada: 597/597 testes, typecheck/lint/build limpos.
- Docs atualizadas: `INTEGRACAO-API-NINJAS.md` (corrigido o "fluxo" desatualizado — a busca do usuário nunca chamou a API ao vivo, só o job administrativo; reescrito para refletir o código real desde a FIT-023), `ADR-004` (nota de atualização), `CATALOGO-DE-EXERCICIOS.md`/`exercises/README.md` (nome novo do comando).

PR ainda não aberto nesta entrada — próximo passo: formalizar a Issue prerequisito e o Épico no GitHub, depois abrir o PR com o status `PRONTO PARA REVISÃO GPT/CODEX — NÃO MERGEAR`.

## Fechamento do IMP-EX-001: Issues #87/#88, PR #89 mergeado

EPIC-12 (#87) e IMP-EX-001 (#88, sub-issue de #87) criados e vinculados no GitHub. PR #89 aberto com o status `PRONTO PARA REVISÃO GPT/CODEX — NÃO MERGEAR`, CI verde (597/597 testes) e sem conflito de merge. Murilo confirmou que a revisão externa (GPT/Codex) já havia sido feita fora desta conversa e autorizou o merge — PR #89 mergeado (squash, `f64d46a`) na `main`.

## Exceção de governança: rota HTTP interna para a carga do catálogo

Ao tentar executar a carga real no Railway, o Product Owner reportou que o acesso SSH/CLI ao Railway não estava funcionando. O IMP-EX-001 (pacote pós-MVP) proíbe explicitamente "endpoint público para disparar a importação" — antes de implementar qualquer rota, essa restrição foi apresentada a Murilo junto com alternativas sem esse risco (`railway run` local, terminal em navegador do painel Railway). Murilo decidiu, de forma explícita e informada sobre o risco, seguir com a rota HTTP mesmo assim.

Implementado como exceção registrada (detalhe completo em `docs/06-engenharia/arquitetura/INTEGRACAO-API-NINJAS.md`, seção "Exceção — rota HTTP interna"):

- `src/modules/exercises/catalogImportOrchestrator.ts` (novo): única implementação da orquestração da carga (antes só existia dentro do script) — usada pelo comando administrativo **e** pela rota HTTP, nunca duplicada.
- `src/modules/exercises/catalogImportRequest.ts` (novo): validação compartilhada das mesmas regras (`environment`, `autorizadoPor`, `autorizarProducao`, `forceReimport`/`justificativa`) entre as duas entradas.
- `src/app/api/admin/catalog-import/route.ts` (novo): `POST` autenticado por segredo próprio (`CATALOG_IMPORT_TRIGGER_SECRET`, header `X-Import-Trigger-Secret`, comparação em tempo constante) — sem a variável configurada, ou com o segredo errado, responde 404 em qualquer método (nunca 405/503, nunca revela se a rota existe). Nunca linkada em nenhuma UI.
- `scripts/import-exercicios.ts` simplificado para usar os dois módulos novos (CLI ficou mais fino, sem lógica duplicada).
- Testes novos: `catalogImportRequest.test.ts`, `catalogImportOrchestrator.integration.test.ts`, `route.test.ts` (404 sem segredo/com segredo errado/GET-PUT-PATCH-DELETE, 400 em validação, 409 em trava/segunda carga, 500 genérico sem vazar detalhe interno). Suíte completa: 617/617, typecheck/lint/build limpos. Smoke test manual contra servidor real (`npm run start`) confirmou os códigos de resposta esperados end-to-end.
- Plano de retirada documentado: remover a rota/variável assim que a carga real for concluída e confirmada, ou assim que o SSH/CLI do Railway voltar a funcionar.

## Exceção adicional: método GET na rota interna

Antes do merge do PR #90, o Product Owner reportou que o curl usado para chamar a rota não funcionava e pediu `GET` em vez de `POST`. Duas coisas verificadas antes de qualquer mudança: (1) o PR #90 ainda não estava mergeado — a rota simplesmente não existia no ambiente de destino ainda, provável causa raiz do próprio "não funciona"; (2) `GET` reabre um risco próprio que `POST`-only evitava (pré-carregamento/cache de navegador e proxy, reenvio automático de ferramentas HTTP em falha de rede). Ambos os pontos foram apresentados a Murilo antes de implementar; ele confirmou o merge do PR #90 e decidiu aceitar o risco adicional do `GET` mesmo assim.

Implementado no mesmo PR #90 (commit adicional, antes do merge): `GET` aceito com os mesmos parâmetros por query string (`?environment=...&dryRun=...&autorizadoPor=...`), mesmo guard de segredo por header (nunca por query string), mesma trava de `CatalogImportRun`. `PUT`/`PATCH`/`DELETE` continuam sempre 404. Lógica de despacho unificada (`handle()` interno à rota) entre `GET` e `POST` — nenhuma duplicação. Testes novos cobrindo o `GET` (404 sem/com segredo errado, 400 validação, 200 dry-run/carga real via query string, 400 em produção sem `autorizarProducao`): 15/15 no arquivo da rota. Suíte completa revalidada, build confirma a rota, smoke test manual contra servidor real (`npm run start`) confirmou `GET` funcionando ponta a ponta via query string. Risco adicional do `GET` documentado em `INTEGRACAO-API-NINJAS.md`.

## Segunda exceção adicional: segredo também aceito por query string (`?secret=`)

Depois do merge do PR #90 (já em produção do repositório, não em Railway), o Product Owner pediu para o segredo também poder ir na URL — a ferramenta usada (navegador/app/webhook, não `curl`) não permite adicionar um header customizado. Risco apresentado antes de implementar, distinto e maior que o do `GET` isolado: um valor na URL fica gravado em log de acesso (aplicação/proxy/Railway, geralmente por semanas), pode aparecer em histórico de navegador, e pode ser exposto via `Referer`. Murilo confirmou que está usando uma ferramenta sem controle de header e aceitou o risco mesmo assim.

Implementado: `isAuthorized()` (`src/app/api/admin/catalog-import/route.ts`) agora aceita o segredo pelo header `X-Import-Trigger-Secret` (preferível) OU pelo parâmetro `?secret=` — vale para `GET` e `POST`. Consequência registrada em `INTEGRACAO-API-NINJAS.md` e `.env.example`: qualquer valor de `CATALOG_IMPORT_TRIGGER_SECRET` usado por URL deve ser tratado como permanentemente exposto a partir do primeiro uso — rotacionar assim que a carga real terminar, nunca reutilizar. Testes novos (`?secret=` certo/errado em `GET`, `?secret=` em `POST`): 18/18 no arquivo da rota, suíte completa revalidada, typecheck/lint/build limpos.

## Diagnóstico em produção (Railway) e correção de bug real

Testando a rota de verdade no Railway (`hml-fitos.up.railway.app`, domínio customizado do mesmo serviço `fitos-web-hml`), o Product Owner recebeu 404 mesmo com deploy atualizado e a variável configurada. Diagnóstico feito só por perguntas (sem acesso a Railway/logs desta sessão): a variável `CATALOG_IMPORT_TRIGGER_SECRET` tinha um espaço extra no nome — corrigido pelo próprio Product Owner, resolvendo o 404.

Testado o `--dry-run` de verdade em seguida (`?secret=admin`, valor fraco usado só para teste — Product Owner avisado para trocar por um valor gerado por `openssl rand -hex 32`, já exposto no histórico do navegador). Resultado revelou duas coisas:

1. `API_NINJAS_API_KEY` está configurada e a rede chega até `api.api-ninjas.com` (confirmado por chamadas reais), mas a maioria das 10 consultas do manifesto falha (`failedSearches: 9` ou `10` entre duas tentativas, `received: 0`) — consistente com rate limit do plano gratuito da API Ninjas, não com um erro de configuração.
2. **Bug real encontrado e corrigido nesta mesma rodada**: `runCatalogImportDryRun` (`catalogImportOrchestrator.ts`) chamava `searchExercises` direto, sem o retry-com-backoff que `runCatalogImport` (carga real) já tinha desde a implementação original do IMP-EX-001 — inconsistência entre os dois fluxos, contra a própria exigência do pacote ("respeitar rate limit... retry com backoff"). Corrigido: os dois fluxos agora usam a mesma função `withBackoff`. Teste novo cobrindo retomada de uma falha transitória sem contar como busca falhada; teste existente de falha permanente ajustado para o tempo real do backoff (10 consultas × 3 tentativas). Suíte completa: 627/627, typecheck/lint/build limpos.

Execução real da carga (fora do `--dry-run`) permanece pendente — depende do plano/rate limit da API Ninjas comportar as 10 consultas do manifesto, verificação que só o Product Owner pode fazer (painel da API Ninjas, aba já aberta durante o teste).

## Mesmo padrão de falha mesmo após o retry-com-backoff — diagnóstico ficou às cegas

Depois do PR #92 (retry-com-backoff no dry-run), o Product Owner testou de novo e reportou "o mesmo erro" — ou seja, mesmo com 3 tentativas por consulta, as falhas continuaram. Como `runCatalogImportDryRun` só devolvia uma contagem agregada (`failedSearches`), sem nenhuma indicação da causa, e esta sessão não tem acesso ao log do Railway, não havia como diferenciar chave inválida (401), plano sem permissão (403) e rate limit (429) só pelo número.

Corrigido: `CatalogImportDryRunReport` ganhou `errorKinds` — contagem por `ApiNinjasError.kind` (`NAO_AUTORIZADO`, `PROIBIDO`, `LIMITE_EXCEDIDO`, `ERRO_SERVIDOR`, `TIMEOUT`, `RESPOSTA_INVALIDA`, ou `DESCONHECIDO` para erro fora do client da API Ninjas) — nenhum campo novo inclui a chave nem o corpo bruto da resposta, mesma garantia já existente em `ApiNinjasError`. Testes novos cobrindo a classificação. Suíte completa: 628/628, typecheck/lint/build limpos. Próximo passo: pedir o JSON de resposta do próximo teste — agora ele deve dizer exatamente qual é o problema.

## Início do EPIC-13 (FitOS Livre): FIT-100 — workspace individual

Murilo autorizou seguir com o EPIC-12 e o EPIC-13 até o fim, história por história, sem pausar para confirmação a cada etapa — mantendo de pé o gate de merge do pacote (todo PR continua `NÃO MERGEAR` até confirmação). O EPIC-12 foi implementado até a FIT-090 (#94, PR #95) e então pausado na FIT-091 por bloqueio real de rede ao Asaas (ver PR #98 e ADR-003) — decisão de Murilo foi seguir para o EPIC-13 (#97) enquanto isso.

FIT-100 (workspace individual) é a primeira História do EPIC-13: dar a uma pessoa que treina sozinha (sem personal) seu próprio espaço na aplicação, provisionado automaticamente no cadastro, no mesmo padrão de autocura já usado para o tenant do personal (FIT-010). Issue [FIT-100] criada (#99, sub-issue de EPIC-13 #97).

Implementado:

- `TenantType` (`PERSONAL`/`INDIVIDUAL`, `@default(PERSONAL)`) em `Tenant.type` e `UserRole.INDIVIDUAL` — migration puramente aditiva (`20260921230135_add_individual_workspace`), nenhuma linha existente muda de significado.
- `ensureTenantForIndividual.ts`: mesmo padrão de idempotência/concorrência de `ensureTenantForPersonal` (constraint física `tenants.ownerId @unique` decide a corrida, o perdedor busca o tenant do vencedor). Deliberadamente não cria `Student` nem qualquer dado de treino — só o workspace; a modelagem de como o próprio praticante se relaciona com treino/execução é decisão da FIT-102 (ver `ADR-006-WORKSPACE-INDIVIDUAL.md`).
- `authContext.ts` (FIT-011): novo ramo de `getAuthContext` para `INDIVIDUAL` (mesma autocura do tenant) e novo `requireIndividual()`; `requirePersonal`/`requireStudent` continuam rejeitando qualquer sessão que não seja exatamente o papel esperado, incluindo `INDIVIDUAL`.
- `auth.ts` (Better Auth): hook de criação de usuário estendido para provisionar o workspace individual simetricamente ao tenant do personal — hoje nenhuma rota pública ainda produz `role: "INDIVIDUAL"` (chega na FIT-101, onboarding "Treino sozinho"); o hook já está pronto para quando existir.
- Testes: `ensureTenantForIndividual.integration.test.ts` (7 testes, incluindo um cadastro real via `betterAuth()` simulando a futura FIT-101) e extensão de `authContext.integration.test.ts` cobrindo `INDIVIDUAL` em `getAuthContext`, `requireIndividual` e a rejeição por `requirePersonal`/`requireStudent`.

## FIT-101 — Onboarding "Treino sozinho"

Issue [FIT-101] criada (#101, sub-issue de EPIC-13 #97). Segunda História: cadastro público com escolha explícita entre "personal" e "individual", e a configuração inicial (objetivo, experiência, disponibilidade) exigida pelo pacote — sem nenhuma alegação de prescrição personalizada.

**Decisão de segurança que precisou ser tomada nesta História**: até aqui, `role` no Better Auth era `input: false` — o cadastro público só podia criar `PERSONAL`, sem nenhuma forma de o cliente influenciar isso. Permitir `INDIVIDUAL` exigia mudar isso. Investigando o próprio código do Better Auth (`parseInputData`), descobri que `input: false` **descarta silenciosamente** qualquer valor enviado (nunca erro) — então simplesmente mudar para `input: true` sem mais nada teria aberto a porta para qualquer cliente se autocadastrar como `"ALUNO"` (contornando o convite/ativação inteiro, FIT-015) ou qualquer string arbitrária. Resolvido com `input: true` **+** `validator.input: z.enum(["PERSONAL", "INDIVIDUAL"])` — o próprio Better Auth já suporta essa validação nativamente, rejeitando com 400 antes de tocar o banco qualquer valor fora desse par. `"ALUNO"` continua impossível de autoatribuir, exatamente como antes. Decisão completa registrada em `ADR-007-SELECAO-DE-PAPEL-NO-CADASTRO.md`, incluída no PR para revisão explícita — é uma mudança na camada de autenticação, então documentada com o mesmo cuidado de uma prova técnica.

Implementado:

- `/treino-sozinho` (nova, pública): proposta de valor e CTA para `/criar-conta?modo=individual`.
- `/criar-conta` ganhou o parâmetro `?modo=individual`: mesma tela e formulário, copy ajustada, e `CriarContaForm` agora passa `role` explícito (`"PERSONAL"` ou `"INDIVIDUAL"`, nunca lido de um campo de formulário) e redireciona para `/onboarding` em vez de `/painel` no modo individual.
- `authClient` (`auth-client.ts`) ganhou o plugin `inferAdditionalFields<typeof auth>()` (com `import type` — nunca traz `auth.ts`, que depende de Prisma/segredos, para o bundle do cliente) para tipar `role` em `signUp.email`.
- `IndividualProfile` (schema + migration aditiva, `tenantId @unique`): objetivo/experiência/disponibilidade — puramente informativo, não gera nenhuma prescrição automática. Módulo `individual-onboarding/onboarding.ts` (`completeIndividualOnboarding` como upsert idempotente, `getIndividualOnboardingProfile`).
- `/onboarding` (nova, só `INDIVIDUAL`, com autocura/redirect do mesmo padrão de `/painel`) + `/api/onboarding` (GET/POST, `requireIndividual`).
- `/painel` ganhou o ramo `INDIVIDUAL`: sem onboarding concluído, redireciona para `/onboarding`; com onboarding, mostra `IndividualHome` novo (mesmo padrão de `AppShell`, nav "Hoje/Treinos/Progresso/Perfil" com os três últimos `comingSoon` até a FIT-102 em diante) — deliberadamente sem nenhuma funcionalidade de treino fabricada antes da hora.
- `SelectField` novo no kit de UI compartilhado (`shared/ui`), mesmo padrão de `TextField` (label/erro/altura mínima de toque 48px).
- `zod` adicionado como dependência direta (já vinha transitivamente pelo Better Auth) — usado pelo validator acima.

Testado: suíte completa (typecheck/lint/vitest/build) e, adicionalmente, um fluxo real de ponta a ponta em navegador via Playwright contra o dev server + Postgres real — `/treino-sozinho` → `/criar-conta?modo=individual` → cadastro real → `/onboarding` → `/painel` mostrando o `IndividualHome` com as respostas salvas; e uma regressão do cadastro padrão de personal (sem `modo`), confirmando que continua indo direto para `/painel`, sem nenhuma mudança de comportamento.
