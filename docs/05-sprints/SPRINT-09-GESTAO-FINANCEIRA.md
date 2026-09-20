# SPRINT-09 — Gestão Financeira

Status: em andamento, checkpoint por História na branch única `feat/conclusao-integral-mvp` (governança do pacote de execução integral, ver `docs/06-engenharia/DIARIO-DE-EXECUCAO-MVP.md`); sem PR nem merge intermediário. A Sprint só é considerada encerrada **de fato** após a aprovação do PR final do programa por GPT/Codex.

## Objetivo

Dar ao personal controle manual sobre cobrança e recebimento: cadastrar cobranças, registrar pagamentos, gerar mensalidades recorrentes e visualizar um resumo financeiro. É a Fase 5 do roadmap.

## Épico

- EPIC-08 — Financeiro (#64, `docs/04-backlog/EPIC-08-FINANCEIRO.md`), aberta nesta rodada.

## Pré-condição verificada antes do início

- `feat/conclusao-integral-mvp` no commit `b6b3e46` — SPRINT-08 concluída (FIT-040 a FIT-042).
- `StudentCharge`/`SaasSubscription` já existem desde a FIT-007 — esta Sprint estende `StudentCharge` com campos aditivos e acrescenta `Payment`/`ChargeRecurrence`, nunca substitui.
- Módulo `src/modules/student-finance/` reservado desde a FIT-007, com regra explícita já registrada em seu README (usada como restrição de design, não inventada agora).
- Nenhum identificador colidindo: FIT-050 a FIT-053 já estavam reservados em `docs/04-backlog/BACKLOG-MVP.md` ("Épico 6 — Financeiro") e nunca haviam sido promovidos a Issue.
- Nenhuma Issue/PR conflitante.

## Histórias

- FIT-050 (#66) — Cadastrar cobrança. **Concluída** (checkpoint na branch `feat/conclusao-integral-mvp` — ver diário de execução para o commit exato).
- FIT-051 (#67) — Registrar pagamento. **Concluída** (checkpoint na branch `feat/conclusao-integral-mvp` — ver diário de execução para o commit exato).
- FIT-052 (#68) — Gerar mensalidades recorrentes.
- FIT-053 (#69) — Exibir resumo financeiro. Encerra a SPRINT-09.

## Resultado intermediário — FIT-050

- migration aditiva `20260921000000_add_student_charge_and_payment`: `StudentCharge` ganha `description`/`referenceMonth`/`cancelReason`/`cancelledAt`; nova tabela `payments` (usada só a partir da FIT-051, mas incluída na mesma migration por depender diretamente desta extensão);
- `src/modules/student-finance/charges.ts` (módulo reservado desde a FIT-007, primeira implementação): `createStudentCharge` (sempre inicia `pendente`, converte reais para centavos), `cancelStudentCharge` (exige motivo, nunca equivale a pagamento — agrupado nesta História por não ter FIT própria), `refreshOverdueCharges` (transição real `pendente` → `atrasado`, auto-contida, sem job em segundo plano), `listChargesForStudent`/`listChargesForTenant`;
- página `/painel/financeiro` (personal, listagem consolidada de todos os alunos, nunca por aluno individual) — item "Financeiro" da navegação deixa de ser "Em breve";
- decisões de escopo registradas (cancelamento agrupado na FIT-050; "atrasado" persistido vs. "a vencer" calculado; nenhuma visão financeira exposta ao aluno) em `docs/06-engenharia/arquitetura/FINANCEIRO.md`.

## Resultado intermediário — FIT-051

- `registerPayment` (`src/modules/student-finance/charges.ts`): grava `Payment` (entidade própria), marca a cobrança como `pago` e registra `AuditEvent` (`PAGAMENTO_REGISTRADO`) — tudo na mesma transação;
- defesa física contra dois pagamentos para a mesma cobrança (`payments.studentChargeId` único, mesmo padrão de `WorkoutSessionResult`/FIT-041); cobrança já paga ou cancelada nunca pode ser paga de novo;
- UI: "Registrar pagamento" e "Cancelar" mutuamente exclusivos na mesma linha do cartão de cobrança; histórico do pagamento (data, valor, forma) sempre visível na cobrança paga;
- nenhuma migration nova (tabela `payments` já existia desde a FIT-050); decisões de escopo (pagamento parcial fora do MVP; auditoria explícita) registradas em `FINANCEIRO.md`.

## Sequenciamento

FIT-050 → FIT-051 → FIT-052 → FIT-053, cada uma com seu próprio commit/checkpoint na branch única, gate autônomo registrado no diário de execução.

## Critérios de sucesso da Sprint

- personal cadastra cobrança (aluno, descrição, valor, competência, vencimento) sempre iniciando pendente;
- cobrança pode ser cancelada com motivo, nunca fisicamente excluída;
- personal registra pagamento (data, valor recebido) e a cobrança passa a paga, com histórico e autoria auditada;
- recorrência gera lançamentos independentes por competência — alteração futura na recorrência não afeta o já gerado;
- geração duplicada da mesma competência impossível por construção (defesa física, não por validação de aplicação apenas);
- resumo financeiro exibe previsto/recebido/pendente/atrasado, com "atrasado" sempre coerente com o vencimento no momento da consulta;
- isolamento entre tenants/alunos comprovado por testes negativos reais em toda operação nova;
- nenhuma credencial ou dado real versionado;
- cada História possui gate autônomo registrado no diário de execução, checkpoint por commit (não por PR).

## Não incluído

- gateway de pagamento real / cobrança automática;
- pagamento parcial ou estorno;
- bloqueio automático de acesso por inadimplência;
- assinatura SaaS do próprio FitOS;
- qualquer feature de Painel Operacional/Consolidação (Fase 6).

## Risco de governança conhecido

A FIT-003 (#4, proteção técnica da `main`) continua tratada conforme o estado real do repositório — `main` permanece `"protected": false`. A disciplina de branch/checkpoint permanece a única salvaguarda efetiva.
