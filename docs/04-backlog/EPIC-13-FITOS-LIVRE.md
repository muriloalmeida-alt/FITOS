# EPIC-13 — FitOS Livre (Fase 2.2 pós-MVP)

## Origem

Mesmo pacote do EPIC-12 (`FitOS_Pacote_Pos_MVP_Fases_2_1_Monetizacao_2_2_Livre_v3.zip`). Esta fase depende do motor de assinatura, notificações e conciliação entregues pelo EPIC-12 apenas na `FIT-105` (assinar o FitOS Livre) — as demais Histórias (`FIT-100` a `FIT-104`, `FIT-106` a `FIT-109`) não dependem de pagamento.

**Atualização (21/09/2026)**: o EPIC-12 foi pausado na `FIT-091` por bloqueio real de rede ao Asaas nesta sessão (ver `EPIC-12-MONETIZACAO.md`). Decisão de Murilo: iniciar o EPIC-13 mesmo assim, começando pela `FIT-100`, e só pausar quando chegar na `FIT-105` (única dependente do motor de assinatura). A frase original acima ("não inicia antes do encerramento e aprovação daquele Épico") descrevia a sequência ideal, mas a dependência real, história por história, é só a listada em "Dependência" abaixo.

## Nota de transparência — renumeração de identificadores

Ver a nota completa em `EPIC-12-MONETIZACAO.md`. Resumo: o pacote reservava `FIT-080` a `FIT-089` para esta fase, faixa já usada pelos Lotes A–D do redesign (EPIC-11). Decisão de Murilo (21/09/2026): renumerar para **FIT-100 a FIT-109**, preservando integralmente conteúdo e ordem.

## Objetivo

**FitOS Livre — Seu treino. Sua evolução.** Produto B2C para quem treina sem personal e para alunos que desejam continuar no FitOS após o encerramento do vínculo profissional.

## Autoridades

Mesmas do EPIC-12: repositório > pacote pós-MVP para direção comercial/experiência > pacote canônico de redesign do MVP para direção visual. Regra central desta fase, já registrada em `06_DADOS_TENANCY_E_CONSENTIMENTO.md` do pacote: **o histórico pertence ao aluno; a prescrição personalizada pertence à relação com o personal.**

## Restrições obrigatórias (do pacote)

- Arquitetura própria e inequívoca — nunca a área do Personal com menus ocultos; sem Alunos, Programas profissionais, cobrança de aluno ou linguagem de carteira.
- Sem prescrição autônoma por IA, marketplace/contratação de personal, transferência automática de dados sem consentimento, ou acesso a prescrições de vínculo encerrado.
- Workspace `INDIVIDUAL` novo ao lado de `PERSONAL` — migration aditiva, ADR próprio, isolamento físico/lógico testado (testes negativos entre workspaces, mesmo padrão de tenancy já usado desde a FIT-007).
- Ao encerrar vínculo: aluno mantém perfil, medidas, fotos privadas, metas, execuções, cargas, frequência, recordes e treinos individuais; perde acesso a planos personalizados, treinos futuros atribuídos, duplicação/reexecução de prescrição e notas privadas do personal.
- Novo vínculo com outro personal exige consentimento explícito, granular e revogável — nenhuma transferência automática de ownership ou tenant.
- Mesmo gate de PR do EPIC-12: `PRONTO PARA REVISÃO GPT/CODEX — NÃO MERGEAR` até aprovação de GPT/Codex e aceite de Produto.

## Histórias (renumeradas — conteúdo integral no pacote, seção `12_BACKLOG_FASE_2_2_FITOS_LIVRE.md`)

| Sprint proposta | História | Resumo |
|---|---|---|
| SPRINT-15 — Fundação individual | FIT-100 | Criar workspace individual (`INDIVIDUAL`, migration aditiva, isolamento) |
| SPRINT-15 | FIT-101 | Onboarding "Treino sozinho" (objetivo, experiência, disponibilidade, sem alegação de prescrição) |
| SPRINT-15 | FIT-102 | Criar treino individual (builder a partir do catálogo local abastecido pela IMP-EX-001) |
| SPRINT-16 — Execução e negócio B2C | FIT-103 | Executar treino individual (séries, carga, descanso, snapshot da execução) |
| SPRINT-16 | FIT-104 | Acompanhar evolução (histórico, frequência, recordes, medidas, metas, fotos privadas) |
| SPRINT-16 | FIT-105 | Assinar o FitOS Livre (reutiliza o motor da Fase 2.1/EPIC-12, produto B2C separado) |
| SPRINT-17 — Continuidade do aluno | FIT-106 | Encerrar vínculo com personal (data, motivo opcional, comunicação) |
| SPRINT-17 | FIT-107 | Preservar histórico do aluno (sem perda ou duplicação) |
| SPRINT-17 | FIT-108 | Proteger prescrições do personal (bloqueio de planos/notas após vínculo encerrado) |
| SPRINT-17 | FIT-109 | Compartilhar com novo personal (consentimento granular, auditoria, revogação) |

Dependência: `FIT-100 → FIT-101 → FIT-102 → FIT-103 → FIT-104 → FIT-105`. O fluxo de continuidade começa em `FIT-106` (exige `FIT-100`), segue `FIT-107`, `FIT-108` e `FIT-109`.

## Direção visual

Shell próprio mobile-first (`Hoje`, `Treinos`, `Progresso`, `Perfil`); superfícies escuras em execução/foco, claras em histórico/edição; `PulseLine` em abertura/progresso/conclusão respeitando `prefers-reduced-motion`; toque mínimo 48×48px; fotografia humana só em onboarding/editorial. Detalhe completo em `07_CONTRATO_VISUAL.md` e `14_ESPECIFICACAO_UX_UI_POS_MVP.md` do pacote.

## Gate de encerramento do Épico

Um usuário entra diretamente no FitOS Livre ou migra de um vínculo encerrado, assina, cria e executa treinos, acompanha evolução e mantém o histórico sem acessar propriedade do antigo personal — tudo validado em homologação, com aprovação de GPT/Codex e aceite de Produto.

## Estado do Épico

**Em andamento.** `FIT-100` (#99, sub-issue de #97) implementada: `Tenant.type`/`UserRole.INDIVIDUAL` (migration aditiva), `ensureTenantForIndividual`, `authContext.ts`/`requireIndividual()`, testes de autorização e isolamento — ver `ADR-006-WORKSPACE-INDIVIDUAL.md`. PR aberto, pendente de revisão/merge.

`FIT-101` (#101, sub-issue de #97) implementada: `/treino-sozinho` (entrada), `/criar-conta?modo=individual` (cadastro com escolha explícita de papel — ver `ADR-007-SELECAO-DE-PAPEL-NO-CADASTRO.md`), `IndividualProfile` (onboarding: objetivo/experiência/disponibilidade), `/onboarding` e o novo ramo `INDIVIDUAL` em `/painel` (`IndividualHome`). Fluxo completo validado em navegador real (Playwright contra o dev server), além da suíte automatizada. PR aberto (stacked sobre o de FIT-100), pendente de revisão/merge.

`FIT-102` (#103, sub-issue de #97) implementada: builder de treino (`/painel/meus-treinos`, `/api/meus-treinos/*`) reaproveitando `workouts.ts`/`exercises.ts` (FIT-030/FIT-023) sem alterar uma linha — só rotas/páginas próprias com `requireIndividual`. A decisão de `Student` adiada pela `ADR-006-WORKSPACE-INDIVIDUAL.md` não foi necessária aqui (o builder não toca `Student`); volta a ser relevante só na FIT-103. PR aberto (stacked sobre o de FIT-101), pendente de revisão/merge.

`FIT-103` em diante seguem conforme a Dependência acima; `FIT-105` permanece bloqueada enquanto o EPIC-12 estiver pausado na `FIT-091`.
