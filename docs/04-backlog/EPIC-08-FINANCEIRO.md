# EPIC-08 — Financeiro

Issue: #64. Fase 5 do roadmap (`docs/00-governanca/ROADMAP.md`).

## Resultado esperado

Dar ao personal controle manual sobre cobrança e recebimento dos alunos: cadastrar cobranças (aluno, descrição, valor, competência, vencimento), registrar pagamentos com histórico, gerar mensalidades recorrentes como lançamentos independentes por competência, e visualizar um resumo financeiro (previsto/recebido/pendente/atrasado). Sem cobrança automática, sem gateway de pagamento real, sem pagamento parcial.

## Histórias

- FIT-050 (#66) — Cadastrar cobrança.
- FIT-051 (#67) — Registrar pagamento.
- FIT-052 (#68) — Gerar mensalidades recorrentes.
- FIT-053 (#69) — Exibir resumo financeiro.

## Dependências

`StudentCharge`/`SaasSubscription` já existem desde a FIT-007. Módulo `src/modules/student-finance/` reservado desde então (README: `status` é sempre um dos quatro estados persistidos `pendente`/`pago`/`atrasado`/`cancelado`; "a vencer" é só apresentação calculada, nunca um estado armazenado) — primeira implementação real nesta Épico. Estruturalmente separado do módulo `saas-subscription` — nenhuma integração de cobrança real/gateway existe nesta Sprint.

## Fora do escopo

- gateway de pagamento real / cobrança automática (Asaas/Mercado Pago — ADR-003, condicionado a prova técnica futura);
- pagamento parcial ou estorno (`REGRAS-DE-NEGOCIO.md` seção 8);
- bloqueio automático de acesso do aluno por inadimplência;
- assinatura SaaS do próprio FitOS (módulo `saas-subscription`, fora do MVP atual);
- qualquer feature de Painel Operacional/Consolidação (Fase 6 — EPIC-09).

## Documentos relacionados

- `docs/01-produto/REGRAS-DE-NEGOCIO.md` (seção 8 — Financeiro; seção 9 — auditoria)
- `docs/01-produto/MODELO-DE-DADOS.md`
- `docs/03-design/CRITICAL-SCREEN-SPECS.md` (seção 7 — Financeiro)
