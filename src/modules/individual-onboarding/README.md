# Módulo: Onboarding individual

Responsabilidade: configuração inicial do onboarding "Treino sozinho" (FIT-101, EPIC-13 — FitOS Livre) — objetivo, experiência e disponibilidade semanal de um workspace `INDIVIDUAL`.

Puramente informativo: não cria `Student`, `Workout` nem qualquer outro dado de treino, e não gera nenhuma prescrição automática. `completeIndividualOnboarding` é idempotente (upsert por `tenantId @unique`) — reabrir o onboarding sempre atualiza o mesmo registro.

Ver `docs/06-engenharia/arquitetura/adr/ADR-006-WORKSPACE-INDIVIDUAL.md` e `ADR-007-SELECAO-DE-PAPEL-NO-CADASTRO.md`.
