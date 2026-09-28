# Módulo: Onboarding individual

Responsabilidade: configuração inicial do onboarding "Treino sozinho" (FIT-101, EPIC-13 — FitOS Livre) — objetivo, experiência e disponibilidade semanal de um workspace `INDIVIDUAL`.

Puramente informativo: não cria `Student`, `Workout` nem qualquer outro dado de treino, e não gera nenhuma prescrição automática. `completeIndividualOnboarding` é idempotente (upsert por `tenantId @unique`) — reabrir o onboarding sempre atualiza o mesmo registro.

**CPF/CNPJ (FIT-128, Issue #153)**: `IndividualProfile.cpfCnpj` (obrigatório desde esta História, `null` só para perfis concluídos antes) — exigido pelo Asaas para criar um cliente real, já que `individual-livre-v2` também é um plano pago real. Mesmo tratamento de `PersonalProfile.cpfCnpj`, validado por `src/shared/lib/cpfCnpj.ts`.

Ver `docs/06-engenharia/arquitetura/adr/ADR-006-WORKSPACE-INDIVIDUAL.md` e `ADR-007-SELECAO-DE-PAPEL-NO-CADASTRO.md`.
