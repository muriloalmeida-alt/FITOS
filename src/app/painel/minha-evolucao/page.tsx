import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell, Card } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { AuthError, requireIndividual } from "@/modules/tenancy/authContext";
import { ensureStudentForIndividual } from "@/modules/tenancy/ensureStudentForIndividual";
import { listAssessmentsForStudent } from "@/modules/evolution/assessments";
import { listGoalsForStudent } from "@/modules/evolution/goals";
import { getFrequencySummaryForStudent, listPersonalRecordsForStudent, listSessionHistoryForStudent } from "@/modules/execution/history";
import { LogoutButton } from "../LogoutButton";
import { INDIVIDUAL_NAV_ITEMS } from "../navigation";
import { EvolucaoChart } from "../progresso/EvolucaoChart";
import { AdicionarMetaForm } from "./AdicionarMetaForm";
import { ConcluirMetaButton } from "./ConcluirMetaButton";
import { AbandonarMetaButton } from "./AbandonarMetaButton";
import { RegistrarAvaliacaoForm } from "./RegistrarAvaliacaoForm";
import { ExcluirAvaliacaoButton } from "./ExcluirAvaliacaoButton";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: `Progresso — ${appName}`,
};

const MEASUREMENT_LABEL: Record<string, string> = {
  CINTURA: "Cintura",
  QUADRIL: "Quadril",
  PEITO: "Peito",
  BRACO: "Braço",
  COXA: "Coxa",
  PANTURRILHA: "Panturrilha",
};

const GOAL_STATUS_LABEL: Record<string, string> = {
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
  ABANDONADA: "Abandonada",
};

/// Evolução do próprio praticante individual (FIT-104) — rota própria
/// (`/painel/minha-evolucao`), nunca `/painel/progresso` (exclusiva do
/// `requireStudent()` do aluno, FIT-042). Histórico/frequência/recordes
/// vêm de `history.ts` (derivados de `WorkoutSession`, somente leitura);
/// medidas reaproveitam `Assessment`/`BodyMeasurement` (FIT-042) com o
/// próprio praticante como autor; metas são a `Goal` nova desta História.
/// "Fotos privadas" (também listada no pacote) está deliberadamente fora
/// desta implementação — bloqueada pela mesma decisão pendente já
/// registrada em `DECISOES-PENDENTES.md` ("Provedor S3 compatível...
/// antes de fotos/anexos"), não uma omissão silenciosa.
export default async function MinhaEvolucaoPage() {
  let ctx;
  try {
    ctx = await requireIndividual();
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    }
    throw error;
  }

  const student = await ensureStudentForIndividual({ id: ctx.tenantId, ownerId: ctx.userId });

  const [historico, frequencia, recordes, avaliacoes, metas] = await Promise.all([
    listSessionHistoryForStudent({ tenantId: ctx.tenantId, studentId: student.id }),
    getFrequencySummaryForStudent({ tenantId: ctx.tenantId, studentId: student.id }),
    listPersonalRecordsForStudent({ tenantId: ctx.tenantId, studentId: student.id }),
    listAssessmentsForStudent({ tenantId: ctx.tenantId, studentId: student.id }),
    listGoalsForStudent({ tenantId: ctx.tenantId, studentId: student.id }),
  ]);

  const weightPoints = avaliacoes
    .filter((a) => a.weightGrams !== null)
    .map((a) => ({ recordedAt: a.recordedAt.toISOString(), weightKg: a.weightGrams! / 1000 }))
    .reverse();

  return (
    <AppShell title="Progresso" navItems={INDIVIDUAL_NAV_ITEMS} activeKey="progresso" trailing={<LogoutButton />}>
      <Card title="Frequência">
        <p className={styles.summaryLine}>
          {frequencia.last7Days} treino{frequencia.last7Days === 1 ? "" : "s"} concluído{frequencia.last7Days === 1 ? "" : "s"} nos
          últimos 7 dias
        </p>
        <p className={styles.summaryLine}>
          {frequencia.last30Days} nos últimos 30 dias · {frequencia.totalConcluded} no total
        </p>
      </Card>

      <Card title="Recordes">
        {recordes.length === 0 ? (
          <p className={styles.empty}>Nenhum recorde ainda — registre uma carga numérica ao executar um treino.</p>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Exercício</th>
                  <th scope="col">Melhor carga</th>
                  <th scope="col">Repetições</th>
                  <th scope="col">Data</th>
                </tr>
              </thead>
              <tbody>
                {recordes.map((recorde) => (
                  <tr key={recorde.exerciseName}>
                    <td>{recorde.exerciseName}</td>
                    <td>{recorde.loadUsed}</td>
                    <td>{recorde.repsCompleted ?? "—"}</td>
                    <td>{new Date(recorde.achievedAt).toLocaleDateString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Histórico de treinos">
        {historico.length === 0 ? (
          <p className={styles.empty}>Nenhum treino concluído ou abandonado ainda.</p>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Data</th>
                  <th scope="col">Treino</th>
                  <th scope="col">Status</th>
                  <th scope="col">Exercícios registrados</th>
                </tr>
              </thead>
              <tbody>
                {historico.map((sessao) => (
                  <tr key={sessao.id}>
                    <td>{new Date(sessao.endedAt ?? sessao.startedAt).toLocaleDateString("pt-BR")}</td>
                    <td>{sessao.workoutName}</td>
                    <td>{sessao.status === "CONCLUIDA" ? "Concluída" : "Abandonada"}</td>
                    <td>{sessao.resultsCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Medidas corporais">
        {weightPoints.length >= 2 ? (
          <div className={styles.chartWrapper}>
            <EvolucaoChart points={weightPoints} />
          </div>
        ) : null}

        {avaliacoes.length === 0 ? (
          <p className={styles.empty}>Nenhuma avaliação registrada ainda.</p>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <caption className={styles.srOnly}>Histórico de avaliações, mais recente primeiro</caption>
              <thead>
                <tr>
                  <th scope="col">Data</th>
                  <th scope="col">Peso</th>
                  <th scope="col">Gordura</th>
                  <th scope="col">Medidas</th>
                  <th scope="col">Observação</th>
                  <th scope="col"> </th>
                </tr>
              </thead>
              <tbody>
                {avaliacoes.map((assessment) => (
                  <tr key={assessment.id}>
                    <td>{new Date(assessment.recordedAt).toLocaleDateString("pt-BR")}</td>
                    <td>{assessment.weightGrams !== null ? `${assessment.weightGrams / 1000}kg` : "—"}</td>
                    <td>{assessment.bodyFatTenthPercent !== null ? `${assessment.bodyFatTenthPercent / 10}%` : "—"}</td>
                    <td>
                      {assessment.measurements.length > 0
                        ? assessment.measurements
                            .map((m) => `${MEASUREMENT_LABEL[m.type] ?? m.type}: ${m.valueMillimeters / 10}cm`)
                            .join(", ")
                        : "—"}
                    </td>
                    <td className={styles.notes}>{assessment.notes ?? "—"}</td>
                    <td>
                      <ExcluirAvaliacaoButton assessmentId={assessment.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className={styles.formWrapper}>
          <RegistrarAvaliacaoForm />
        </div>
      </Card>

      <Card title="Metas">
        {metas.length === 0 ? (
          <p className={styles.empty}>Nenhuma meta ainda.</p>
        ) : (
          <ul className={styles.goalList}>
            {metas.map((goal) => (
              <li key={goal.id} className={styles.goalItem}>
                <div>
                  <p className={styles.goalDescription}>{goal.description}</p>
                  <p className={styles.goalMeta}>
                    {GOAL_STATUS_LABEL[goal.status] ?? goal.status}
                    {goal.targetDate ? ` · até ${new Date(goal.targetDate).toLocaleDateString("pt-BR")}` : ""}
                  </p>
                </div>
                {goal.status === "EM_ANDAMENTO" ? (
                  <div className={styles.goalActions}>
                    <ConcluirMetaButton goalId={goal.id} />
                    <AbandonarMetaButton goalId={goal.id} />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <div className={styles.formWrapper}>
          <AdicionarMetaForm />
        </div>
      </Card>
    </AppShell>
  );
}
