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

## SPRINT-08 — Experiência do Aluno (formalização)

Sem pausa entre Sprints, conforme mandato do pacote. Formalizados: EPIC-07 (#60), FIT-040 (#61), FIT-041 (#62), FIT-042 (#63) — `docs/04-backlog/EPIC-07-EXPERIENCIA-DO-ALUNO.md`, `docs/05-sprints/SPRINT-08-EXPERIENCIA-DO-ALUNO.md`, `docs/00-governanca/ROADMAP.md` (Fase 4) atualizados. Issues criadas via GitHub MCP no estado real ("Não iniciada"/critérios não marcados) — **correção registrada aqui**: a primeira escrita da Issue #61 (FIT-040) foi por engano publicada já como "Concluída" com os critérios marcados, antes de qualquer código existir; corrigida na mesma sessão, antes de qualquer outra ação, para o estado real ("Não iniciada"). Registrado por transparência, não por ser um erro de dado de produto — nenhum código foi afetado.

**Erro adicional encontrado e corrigido durante a redação do EPIC-07**: a primeira versão do documento citou entre aspas, como se fossem texto literal de `docs/01-produto/REGRAS-DE-NEGOCIO.md`, frases que na verdade eram minha própria paráfrase ("Aluno registra execução real...", "Sessão de treino não pode ser criada...", "Avaliações físicas seguem regras de LGPD..."). Verificação linha a linha contra o arquivo real antes de prosseguir mostrou que o texto verdadeiro é outro (seções 6/7/9: "Estados: `planejada`, `em_andamento`, `concluida` e `abandonada`", "O histórico de execução não pode ser recalculado após mudança do plano", "Fotografias são opcionais e exigem autorização explícita do aluno", etc.). Corrigido antes de qualquer commit — nenhuma citação fabricada chegou a ser versionada. Registrado como lembrete operacional: sempre ler o arquivo-fonte antes de citá-lo entre aspas, mesmo quando o conteúdo parece previsível.

**Decisão de design registrada — os quatro estados da tela "Hoje" (FIT-040)**: nem `PROMPT_MESTRE.md` nem `CRITICAL-SCREEN-SPECS.md` especificam o algoritmo exato de "próximo treino". Interpretação adotada, documentada aqui para revisão externa: dado o vocabulário fixo de `suggestedDays` já usado na UI do personal desde a FIT-030 (`SEGUNDA`/`TERCA`/`QUARTA`/`QUINTA`/`SEXTA`/`SABADO`/`DOMINGO`), a tela "Hoje" busca, entre os modelos do plano atribuído (na ordem de posição), o primeiro cujo `suggestedDays` inclua o dia da semana atual (hora do servidor — mesma simplificação de fuso já aceita em `daysUntil`, FIT-015). Se nenhum modelo tiver esse dia — inclusive quando nenhum modelo tem `suggestedDays` configurado — o estado é "descanso". "Treino futuro" é lido literalmente: o treino encontrado para hoje ainda não foi executado (não existe registro de sessão até a FIT-041) — não é um estado de "próximo dia da semana com treino", que exigiria um motor de agendamento fora do escopo do MVP (`EPIC-07`, "Fora do escopo"). Se dois modelos do mesmo plano tiverem o mesmo dia configurado, o primeiro por posição vence — limitação aceita, não uma regra de negócio pedida por nenhum documento.

## SPRINT-09 — Gestão Financeira (formalização)

Sem pausa entre Sprints, conforme mandato do pacote. Formalizados: EPIC-08 (#64), FIT-050 (#66), FIT-051 (#67), FIT-052 (#68), FIT-053 (#69), EPIC-09 (#65), FIT-060 (#70) — `docs/04-backlog/EPIC-08-FINANCEIRO.md`, `docs/04-backlog/EPIC-09-PAINEL-OPERACIONAL.md`, `docs/05-sprints/SPRINT-09-GESTAO-FINANCEIRA.md`, `docs/05-sprints/SPRINT-10-PAINEL-OPERACIONAL.md`, `docs/00-governanca/ROADMAP.md` (Fases 5/6) atualizados. Issues criadas via GitHub MCP já no estado real ("Não iniciada"/critérios não marcados) desde o primeiro registro — nenhuma correção necessária desta vez.

**Decisão de design registrada — "atrasado" é persistido, "a vencer" não é (FIT-050)**: `REGRAS-DE-NEGOCIO.md` seção 8 lista `pendente`/`pago`/`atrasado`/`cancelado` como os quatro estados persistidos, mas `CRITICAL-SCREEN-SPECS.md` seção 7 e o README de `src/modules/student-finance/` (desde a FIT-007) dizem que "a vencer" é só apresentação calculada. Sem infraestrutura de agendamento (mesma decisão da FIT-020/023), a transição real `pendente` → `atrasado` é aplicada por `refreshOverdueCharges`, chamada de forma auto-contida no início de toda leitura agregada (nunca por um job em segundo plano) — idempotente, escopada por tenant. "A vencer" continua sendo resolvido só na UI, nunca no domínio, nunca escrito.

**Decisão de escopo registrada — cancelamento de cobrança agrupado na FIT-050**: nenhuma História do backlog original (FIT-050 a FIT-053) reivindica a ação de cancelar uma cobrança, apesar de `cancelado` ser um dos quatro estados da regra de negócio. Como é o contraponto direto do ciclo de vida da cobrança recém-criada, foi implementado junto com a FIT-050, e registrado explicitamente aqui e na Issue #66 para transparência com a revisão externa.

**Decisão de escopo registrada — `Payment` chega no schema da FIT-050, mas só é usado na FIT-051**: `Payment` depende diretamente da extensão de `StudentCharge` feita na FIT-050 (mesma migration, `20260921000000_add_student_charge_and_payment`) — dividir em duas migrations sequenciais não agregaria nada, já que as duas Histórias chegam no mesmo checkpoint de mudança de schema. A tabela existe desde a FIT-050 mas permanece sem nenhuma linha até o código da FIT-051 ser escrito.
