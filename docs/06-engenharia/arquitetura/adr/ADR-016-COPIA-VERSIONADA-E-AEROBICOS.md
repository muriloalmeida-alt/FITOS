# ADR-016 — Cópia do aluno versionada e aeróbicos

**Status:** aceita (EPIC-28)

## Contexto

Atribuir um programa cria uma cópia imutável para o aluno (snapshot,
ADR-005), protegida por TRIGGER: nenhum treino ou item de um plano
snapshot pode ser inserido, alterado ou apagado. O personal agora precisa
ajustar a cópia de um aluno (trocar um exercício por outro do mesmo grupo
muscular, mudar séries, tempo e intensidade, acrescentar um treino ou um
aeróbico) sem mexer no modelo da biblioteca e sem reescrever o histórico.

## Decisão

1. **Ajustar a cópia gera uma nova versão.** `reviseStudentCopy` clona a
   versão ativa com a mudança aplicada, marca a nova como snapshot e
   aponta a `PlanAssignment` ativa para ela. A data de início
   (`assignedAt`) não muda, então a semana do programa continua a mesma.
   O TRIGGER de imutabilidade continua valendo sem exceção.
2. **O histórico fica na versão em que aconteceu.** Sessões e séries
   apontam para os treinos e itens da versão antiga, que nunca muda.
3. **Desfazer** volta a atribuição para a versão anterior
   (`restoreStudentCopy`), aceitando só uma cópia do mesmo espaço que
   nenhum outro aluno usa.
4. **Aeróbico é um item por tempo.** Exercício do tipo `Aeróbico` no
   catálogo (inseridos pela migração `20261007090000`), prescrito com
   `durationSeconds` e `intensity` (`LEVE`, `MODERADO`, `FORTE`,
   `INTERVALADO`), sem séries nem repetições. O treino ao vivo divide o
   tempo em etapas (aquecimento, ritmo ou tiros, desaquecimento).
5. **Biblioteca inicial.** Na primeira visita, o espaço recebe programas,
   treinos e aeróbicos prontos (`ensureStarterLibrary`), marcados por
   `Tenant.starterLibraryAt` para nunca serem recriados.

## Consequências

- Versões antigas de cópias ficam no banco (não podem ser apagadas pelo
  TRIGGER). São poucas linhas por ajuste e preservam o histórico.
- Uma sessão em andamento continua na versão em que começou.
