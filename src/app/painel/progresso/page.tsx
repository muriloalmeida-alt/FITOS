import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ActionRow, AppShell } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { prisma } from "@/shared/db/prisma";
import { AuthError, requireStudent } from "@/modules/tenancy/authContext";
import { listAssessmentsForStudent } from "@/modules/evolution/assessments";
import { buildEvolution } from "@/modules/evolution/evolutionSeries";
import { listPersonalRecordsForStudent } from "@/modules/execution/history";
import { LogoutButton } from "../LogoutButton";
import { ALUNO_NAV_ITEMS } from "../navigation";
import { EvolutionView } from "../_evolution/EvolutionView";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: `Progresso — ${appName}`,
};

const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });

function fmt(value: number) {
  return (Math.round(value * 10) / 10).toLocaleString("pt-BR");
}

/// Progresso do Aluno (FIT-154, A4 do protótipo), só da própria sessão:
/// métrica em chips com gráfico, medidas da primeira para a última
/// avaliação, histórico de avaliações e o bloco Treinos (treinos no mês e
/// melhores cargas, BK-12). Somente leitura: avaliar é do personal.
export default async function ProgressoPage() {
  let ctx;
  try {
    ctx = await requireStudent();
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    }
    throw error;
  }

  const scope = { tenantId: ctx.tenantId, studentId: ctx.studentId };
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [assessments, records, monthSessions, student] = await Promise.all([
    listAssessmentsForStudent(scope),
    listPersonalRecordsForStudent(scope),
    prisma.workoutSession.count({ where: { ...scope, status: "CONCLUIDA", startedAt: { gte: monthStart } } }),
    prisma.student.findUniqueOrThrow({ where: { id: ctx.studentId }, include: { tenant: { include: { owner: true } } } }),
  ]);
  const { series, measures } = buildEvolution(assessments);
  const best = [...records].sort((a, b) => b.achievedAt.getTime() - a.achievedAt.getTime()).slice(0, 5);
  const month = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(now);

  return (
    <AppShell eyebrow="Progresso" title="Sua evolução" navItems={ALUNO_NAV_ITEMS} activeKey="progresso" trailing={<LogoutButton />}>
      {series.length > 0 ? (
        <EvolutionView series={series} measures={measures} />
      ) : (
        <p className={styles.empty}>Nenhuma avaliação ainda. {student.tenant.owner.name} registra a sua na próxima avaliação e ela aparece aqui.</p>
      )}

      <section className={styles.section} aria-labelledby="treinos">
        <h2 id="treinos" className={styles.title}>
          Treinos
        </h2>
        <div className={styles.stat}>
          <span className={styles.statValue}>{monthSessions}</span>
          <span className={styles.muted}>{monthSessions === 1 ? `treino em ${month}` : `treinos em ${month}`}</span>
        </div>
        {best.length > 0 ? (
          <>
            <h3 className={styles.subtitle}>Melhores cargas</h3>
            <ul className={styles.list}>
              {best.map((record) => (
                <li key={record.exerciseName}>
                  <ActionRow title={record.exerciseName} description={dateFmt.format(record.achievedAt)} trailing={<strong>{`${fmt(record.loadValue)} kg${record.repsCompleted ? ` × ${record.repsCompleted}` : ""}`}</strong>} />
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className={styles.empty}>Suas melhores cargas aparecem aqui depois dos primeiros treinos.</p>
        )}
      </section>

      {assessments.length > 0 ? (
        <section className={styles.section} aria-labelledby="historico">
          <h2 id="historico" className={styles.title}>
            Avaliações
          </h2>
          <ul className={styles.list}>
            {assessments.map((assessment) => {
              const parts = [assessment.weightGrams !== null ? `${fmt(assessment.weightGrams / 1000)} kg` : null, assessment.bodyFatTenthPercent !== null ? `${fmt(assessment.bodyFatTenthPercent / 10)}% gordura` : null].filter(Boolean);
              return (
                <li key={assessment.id}>
                  <ActionRow title={dateFmt.format(assessment.recordedAt)} description={[parts.join(" · ") || "Sem peso e gordura", assessment.notes].filter(Boolean).join(" · ")} />
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </AppShell>
  );
}
