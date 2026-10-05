import "server-only";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { createZip, toCsv } from "@/shared/lib/zip";
import { formatDays } from "@/shared/lib/weekdays";

/// Exportação dos dados do personal (Configurações, EPIC-37, LGPD): um ZIP
/// com planilhas (CSV para Excel em português) de alunos, programas e
/// treinos, treinos realizados, avaliações, metas e cobranças. Só o
/// espaço da própria sessão.

const dateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" });
const dateTimeFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
const date = (value: Date | null | undefined) => (value ? dateFmt.format(value) : "");
const dateTime = (value: Date | null | undefined) => (value ? dateTimeFmt.format(value) : "");
const decimal = (value: number) => String(Math.round(value * 100) / 100).replace(".", ",");
const money = (cents: number) => decimal(cents / 100);

const STATUS: Record<string, string> = {
  ATIVO: "Ativo",
  INATIVO: "Inativo",
  VINCULO_ENCERRADO: "Vínculo encerrado",
  CONCLUIDA: "Concluído",
  ABANDONADA: "Abandonado",
  EM_ANDAMENTO: "Em andamento",
  PENDENTE: "A vencer",
  ATRASADO: "Atrasada",
  PAGO: "Paga",
  CANCELADO: "Cancelada",
};
const label = (value: string) => STATUS[value] ?? value;
const GOAL_STATUS: Record<string, string> = { EM_ANDAMENTO: "Em andamento", CONCLUIDA: "Concluída", ABANDONADA: "Abandonada" };
const MEASUREMENT: Record<string, string> = { CINTURA: "Cintura", QUADRIL: "Quadril", PEITO: "Peito", BRACO: "Braço", COXA: "Coxa", PANTURRILHA: "Panturrilha" };

export async function buildPersonalExport(input: { tenantId: string; now?: Date }, client: PrismaClient = prisma): Promise<{ filename: string; zip: Uint8Array }> {
  const now = input.now ?? new Date();
  const { tenantId } = input;
  const [tenant, students, plans, assignments, sessions, setResults, assessments, goals, charges] = await Promise.all([
    client.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { name: true, owner: { select: { name: true, email: true } } } }),
    client.student.findMany({ where: { tenantId }, orderBy: { displayName: "asc" } }),
    client.trainingPlan.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
      include: { workouts: { orderBy: { position: "asc" }, include: { workoutExercises: { orderBy: { position: "asc" }, include: { exercise: { select: { name: true } } } } } } },
    }),
    client.planAssignment.findMany({ where: { tenantId, active: true }, select: { trainingPlanId: true, student: { select: { displayName: true } } } }),
    client.workoutSession.findMany({ where: { tenantId }, orderBy: { startedAt: "asc" }, include: { student: { select: { displayName: true } }, workout: { select: { name: true } } } }),
    client.workoutSetResult.findMany({
      where: { tenantId },
      orderBy: [{ completedAt: "asc" }, { setNumber: "asc" }],
      include: { workoutSession: { select: { startedAt: true, student: { select: { displayName: true } }, workout: { select: { name: true } } } }, workoutExercise: { select: { exercise: { select: { name: true } } } } },
    }),
    client.assessment.findMany({ where: { tenantId, deletedAt: null }, orderBy: { recordedAt: "asc" }, include: { student: { select: { displayName: true } }, measurements: true } }),
    client.goal.findMany({ where: { tenantId }, orderBy: { createdAt: "asc" }, include: { student: { select: { displayName: true } } } }),
    client.studentCharge.findMany({ where: { tenantId }, orderBy: { dueDate: "asc" }, include: { student: { select: { displayName: true } }, payment: true } }),
  ]);

  const studentsByPlan = new Map<string, string[]>();
  for (const assignment of assignments) studentsByPlan.set(assignment.trainingPlanId, [...(studentsByPlan.get(assignment.trainingPlanId) ?? []), assignment.student.displayName]);
  // Biblioteca (programas e "Meus modelos") e a cópia atual de cada aluno; versões antigas ficam de fora.
  const exportedPlans = plans.filter((plan) => !plan.isSnapshot || studentsByPlan.has(plan.id));
  const measurementTypes = [...new Set(assessments.flatMap((entry) => entry.measurements.map((measurement) => measurement.type)))].sort();

  const files = [
    {
      name: "LEIA-ME.txt",
      content: `Dados do espaço ${tenant.name} no FitOS\r\nResponsável: ${tenant.owner.name} <${tenant.owner.email}>\r\nGerado em ${dateTime(now)} (horário de Brasília).\r\n\r\nCada arquivo .csv abre no Excel, Numbers ou Google Planilhas (separador ";").\r\n`,
    },
    {
      name: "alunos.csv",
      content: toCsv(
        ["Nome", "E-mail", "Situação", "Tem acesso ao app", "Objetivo", "Dias combinados", "Aluno desde", "Vínculo encerrado em", "Motivo do encerramento"],
        students.map((student) => [student.displayName, student.email, label(student.status), student.userId ? "Sim" : "Não", student.objective, student.preferredDays.length > 0 ? formatDays(student.preferredDays) : "", date(student.createdAt), date(student.endedAt), student.endReason])
      ),
    },
    {
      name: "programas-e-treinos.csv",
      content: toCsv(
        ["Programa", "Semanas", "Aluno", "Treino", "Dias", "Ordem", "Exercício", "Séries", "Repetições", "Tempo (s)", "Carga", "Descanso (s)", "Intensidade", "Observações"],
        exportedPlans.flatMap((plan) => {
          const planName = plan.isDraftBucket ? "Treinos avulsos" : plan.name;
          const owners = (studentsByPlan.get(plan.id) ?? []).join(", ");
          return plan.workouts.flatMap((workout) =>
            workout.workoutExercises.map((item, index) => [planName, plan.durationWeeks, owners, workout.name, workout.suggestedDays.length > 0 ? formatDays(workout.suggestedDays) : "", index + 1, item.exercise.name, item.sets, item.reps, item.durationSeconds, item.load, item.restSeconds, item.intensity, item.notes])
          );
        })
      ),
    },
    {
      name: "treinos-realizados.csv",
      content: toCsv(
        ["Data", "Aluno", "Treino", "Situação", "Esforço (1 a 5)", "Tempo ativo (min)"],
        sessions.map((session) => [dateTime(session.startedAt), session.student.displayName, session.workout.name, label(session.status), session.perceivedEffort, session.activeSeconds ? Math.round(session.activeSeconds / 60) : ""])
      ),
    },
    {
      name: "series-registradas.csv",
      content: toCsv(
        ["Data", "Aluno", "Treino", "Exercício", "Série", "Repetições", "Tempo (s)", "Carga (kg)"],
        setResults.map((set) => [dateTime(set.workoutSession.startedAt), set.workoutSession.student.displayName, set.workoutSession.workout.name, set.workoutExercise.exercise.name, set.setNumber, set.reps, set.durationSeconds, set.loadGrams !== null ? decimal(set.loadGrams / 1000) : ""])
      ),
    },
    {
      name: "avaliacoes.csv",
      content: toCsv(
        ["Data", "Aluno", "Peso (kg)", "Gordura (%)", ...measurementTypes.map((type) => `${MEASUREMENT[type] ?? type} (cm)`), "Observações"],
        assessments.map((entry) => [
          date(entry.recordedAt),
          entry.student.displayName,
          entry.weightGrams !== null ? decimal(entry.weightGrams / 1000) : "",
          entry.bodyFatTenthPercent !== null ? decimal(entry.bodyFatTenthPercent / 10) : "",
          ...measurementTypes.map((type) => {
            const found = entry.measurements.find((measurement) => measurement.type === type);
            return found ? decimal(found.valueMillimeters / 10) : "";
          }),
          entry.notes,
        ])
      ),
    },
    {
      name: "metas.csv",
      content: toCsv(
        ["Aluno", "Meta", "Prazo", "Situação", "Criada em", "Encerrada em"],
        goals.map((goal) => [goal.student.displayName, goal.description, date(goal.targetDate), GOAL_STATUS[goal.status] ?? goal.status, date(goal.createdAt), date(goal.completedAt)])
      ),
    },
    {
      name: "cobrancas.csv",
      content: toCsv(
        ["Aluno", "Descrição", "Vencimento", "Valor (R$)", "Situação", "Pago em", "Valor pago (R$)", "Forma de pagamento", "Motivo do cancelamento"],
        charges.map((charge) => [charge.student.displayName, charge.description, date(charge.dueDate), money(charge.amountCents), charge.payment ? "Paga" : label(charge.status), date(charge.payment?.paidAt), charge.payment ? money(charge.payment.amountCentsPaid) : "", charge.payment?.method, charge.cancelReason])
      ),
    },
  ];

  const stamp = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
  return { filename: `fitos-dados-${stamp}.zip`, zip: createZip(files, now) };
}
