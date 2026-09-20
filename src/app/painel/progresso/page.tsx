import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell, Card } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { AuthError, requireStudent } from "@/modules/tenancy/authContext";
import { listAssessmentsForStudent } from "@/modules/evolution/assessments";
import { LogoutButton } from "../LogoutButton";
import { ALUNO_NAV_ITEMS } from "../navigation";
import { EvolucaoChart } from "./EvolucaoChart";
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

/// Própria evolução do aluno (FIT-042), exclusiva do papel ALUNO —
/// `requireStudent()` garante isso no servidor, mesmo padrão da
/// FIT-016/033/040. Sempre lê a evolução do próprio aluno da sessão
/// (nunca um `studentId` vindo do cliente) — nunca a de outro aluno.
/// Somente leitura: registrar/excluir avaliação é exclusivo do personal
/// (ficha do aluno, `/painel/alunos/[id]`).
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

  const assessments = await listAssessmentsForStudent({ tenantId: ctx.tenantId, studentId: ctx.studentId });

  if (assessments.length === 0) {
    return (
      <AppShell title="Progresso" navItems={ALUNO_NAV_ITEMS} activeKey="progresso" trailing={<LogoutButton />}>
        <Card title="Sua evolução">
          <p className={styles.empty}>Nenhuma avaliação registrada ainda. Fale com seu personal.</p>
        </Card>
      </AppShell>
    );
  }

  // Mais antiga primeiro para o gráfico (evolução no tempo); a tabela
  // abaixo mantém a ordem mais recente primeiro, já vinda de
  // `listAssessmentsForStudent`.
  const weightPoints = assessments
    .filter((a) => a.weightGrams !== null)
    .map((a) => ({ recordedAt: a.recordedAt.toISOString(), weightKg: a.weightGrams! / 1000 }))
    .reverse();

  return (
    <AppShell title="Progresso" navItems={ALUNO_NAV_ITEMS} activeKey="progresso" trailing={<LogoutButton />}>
      <Card title="Sua evolução">
        {weightPoints.length >= 2 ? (
          <div className={styles.chartWrapper}>
            <EvolucaoChart points={weightPoints} />
          </div>
        ) : null}

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
              </tr>
            </thead>
            <tbody>
              {assessments.map((assessment) => (
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </AppShell>
  );
}
