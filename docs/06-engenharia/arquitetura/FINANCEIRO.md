# Financeiro (EPIC-08)

Módulo `src/modules/student-finance/`, reservado desde a FIT-007. Este documento registra as decisões de design tomadas Sprint a Sprint, na ordem em que as Histórias foram implementadas.

## FIT-050 — Cadastrar cobrança

- `StudentCharge.status` é sempre um dos quatro estados persistidos `pendente`/`pago`/`atrasado`/`cancelado` (`REGRAS-DE-NEGOCIO.md` seção 8; regra já registrada desde a FIT-007 no README do módulo). "A vencer" nunca é escrito — é apresentação calculada sobre `pendente` com `dueDate` futuro, resolvida na própria UI (`displayStatusLabel` em `FinanceiroSection.tsx`), nunca no domínio.
- A transição `pendente` → `atrasado`, ao contrário de "a vencer", **é** persistida (é um dos quatro estados da regra de negócio). Sem infraestrutura de agendamento/cron nesta MVP (mesma decisão já tomada na FIT-020/023), a transição é aplicada de forma auto-contida por `refreshOverdueCharges` no início de toda leitura agregada (`listChargesForStudent`/`listChargesForTenant`) — idempotente, sem efeito visível para quem lê além do estado já correto. Comparação feita contra o início do dia de hoje: uma cobrança que vence hoje ainda não é atrasada.
- `referenceMonth` (competência) e `dueDate` (vencimento) são campos distintos por regra de produto (mesma seção 8) — nunca coalescidos, mesmo quando o formulário os preenche a partir do mesmo mês.
- Cancelamento (`cancelStudentCharge`) foi agrupado nesta História, não em uma FIT separada: nenhuma História do backlog reivindica essa ação, e ela é o contraponto direto do ciclo de vida da cobrança criada aqui. Exige motivo (`cancelReason`), nunca equivale a pagamento, e uma cobrança já paga nunca pode ser cancelada por esta via — o cenário de estorno de um pagamento já registrado está fora do MVP.
- `Payment` (quitação) já existe no schema desde esta migration (`20260921000000_add_student_charge_and_payment`), mas só é usado a partir da FIT-051 — schema e código de domínio da FIT-051 chegam juntos porque `Payment` depende diretamente da extensão de `StudentCharge` feita aqui; a migration única cobre as duas Histórias.
- Tela `/painel/financeiro` (personal, listagem consolidada de todos os alunos) escolhida em vez de um card na ficha de cada aluno — nenhuma História desta Sprint pede uma visão por aluno, e o design (`CRITICAL-SCREEN-SPECS.md` seção 7 — "Lista de recebimentos") já descreve exatamente essa visão consolidada. Torna real o item "Financeiro" da navegação do personal (antes "Em breve" desde a FIT-012).
- Nenhuma visão financeira foi exposta ao próprio aluno: nenhuma História do backlog (FIT-050 a FIT-053) é escrita da perspectiva do aluno — implementá-la seria especulativo.

## FIT-051 — Registrar pagamento

- `Payment` é uma entidade própria, nunca campos soltos em `StudentCharge` — "cobrança pode possuir zero ou um pagamento no MVP" (`MODELO-DE-DADOS.md`). Defesa física contra um segundo pagamento para a mesma cobrança: `payments.studentChargeId` é `@unique`, mesmo padrão já usado em `WorkoutSessionResult` (FIT-041) — a checagem de estado (`status !== "PAGO"`) já impede isso no fluxo normal, mas o índice único garante que nenhuma condição de corrida jamais produza dois pagamentos para a mesma cobrança.
- Pagamento parcial fica fora do MVP (`REGRAS-DE-NEGOCIO.md` seção 8): o valor recebido (`amountCentsPaid`) é só histórico — não há reconciliação de saldo restante, e a cobrança sempre passa a `pago` num único pagamento, nunca "parcialmente paga". Se o valor recebido divergir do valor da cobrança, isso não é validado nem impedido — é uma decisão de produto fora do escopo desta MVP, não um bug.
- `AuditEvent` (`action: "PAGAMENTO_REGISTRADO"`) é escrito em toda chamada — `REGRAS-DE-NEGOCIO.md` seção 9 lista "pagamento" explicitamente entre as entidades auditadas (ao contrário de `WorkoutSession`/FIT-041, que não é auditada).
- Uma cobrança `cancelada` nunca pode ser paga, e uma já `paga` nunca pode ser paga de novo — os dois casos retornam `ESTADO_INVALIDO`, nunca uma exceção genérica.
- UI: "Registrar pagamento" e "Cancelar" são ações mutuamente exclusivas na mesma linha (um único `activeAction` de estado em `FinanceiroSection.tsx`) — nunca os dois formulários abertos ao mesmo tempo para a mesma cobrança.

## FIT-052 — Gerar mensalidades recorrentes

- `ChargeRecurrence` é a definição da recorrência (aluno, descrição, valor, dia de vencimento); `generateNextChargeForRecurrence` cria um `StudentCharge` físico independente a cada chamada — "cobrança recorrente gera lançamentos independentes por competência" (`REGRAS-DE-NEGOCIO.md` seção 8). Alterar `amountCents`/`description` na recorrência depois nunca muda um lançamento já gerado (comprovado por teste real).
- Competência do próximo lançamento: a do mês da criação, se nada foi gerado ainda; senão, o mês seguinte ao mais recente já gerado para aquela recorrência — nunca um mês escolhido livremente nesta MVP.
- `dueDayOfMonth` é limitado a 1-28 (nunca 29/30/31): assim todo mês tem esse dia por construção, sem nenhuma regra de "cair no dia mais próximo do fim do mês" que nenhum documento pediu.
- Defesa física contra geração duplicada da mesma competência: índice único `student_charges_recurrenceId_referenceMonth_key` (`recurrenceId`, `referenceMonth`) — `NULL` nunca colide com `NULL` nessa constraint, então cobranças sem recorrência (a maioria) nunca são afetadas.
- Sem infraestrutura de agendamento/cron nesta MVP (mesma decisão já tomada na FIT-020/023): gerar a próxima competência é sempre uma ação explícita do personal ("Gerar cobrança do mês"), nunca automática.
- Encerrar uma recorrência (`endChargeRecurrence`) nunca é uma exclusão física — mesma filosofia de arquivamento do restante da aplicação (`Workout`/`Exercise`/`TrainingPlan`). Lançamentos já gerados nunca são afetados; idempotente para uma já encerrada.
- `StudentCharge.recurrence` usa `onDelete: Restrict` (nunca `SetNull`): como `StudentCharge.tenantId` é obrigatório, uma FK composta com `SetNull` violaria essa restrição na prática — e de qualquer forma recorrências nunca são fisicamente excluídas, apenas encerradas.
