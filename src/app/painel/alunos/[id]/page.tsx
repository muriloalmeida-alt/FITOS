import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell, Button, Card } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { AuthError, requirePersonal } from "@/modules/tenancy/authContext";
import { getStudentForTenant } from "@/modules/students/students";
import { daysUntil, deriveAccessStatus, getLatestInvitationForStudent } from "@/modules/students/invitations";
import {
  getActivePlanAssignmentForStudent,
  listEndedPlanAssignmentsForStudent,
  listTrainingPlansForTenant,
} from "@/modules/workouts/workouts";
import { listAssessmentsForStudent } from "@/modules/evolution/assessments";
import { LogoutButton } from "../../LogoutButton";
import { PERSONAL_NAV_ITEMS } from "../../navigation";
import { EditarAlunoForm } from "./EditarAlunoForm";
import { ReativarAlunoButton } from "./ReativarAlunoButton";
import { ConviteSection } from "./ConviteSection";
import { PlanoDoAlunoSection } from "./PlanoDoAlunoSection";
import { AvaliacoesSection } from "./AvaliacoesSection";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: `Perfil do aluno — ${appName}`,
};

interface AlunoPerfilPageProps {
  params: Promise<{ id: string }>;
}

/// Perfil do aluno (FIT-014). Busca sempre por `[id, tenantId da sessão]`
/// (`getStudentForTenant`) — um `id` de outro tenant nunca é encontrado, e
/// a resposta (404) não revela se aquele `id` existe em outro lugar.
export default async function AlunoPerfilPage({ params }: AlunoPerfilPageProps) {
  let ctx;
  try {
    ctx = await requirePersonal();
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    }
    throw error;
  }

  const { id } = await params;
  const student = await getStudentForTenant({ tenantId: ctx.tenantId, studentId: id });
  if (!student) {
    notFound();
  }

  const podeEditarEmail = student.userId === null;
  const latestInvitation = await getLatestInvitationForStudent({ tenantId: ctx.tenantId, studentId: student.id });
  const accessStatus = deriveAccessStatus(student, latestInvitation);
  const diasRestantes =
    accessStatus === "CONVITE_PENDENTE" && latestInvitation ? daysUntil(latestInvitation.expiresAt) : null;

  const [activeAssignment, endedAssignments, availablePlans, assessments] = await Promise.all([
    getActivePlanAssignmentForStudent({ tenantId: ctx.tenantId, studentId: student.id }),
    listEndedPlanAssignmentsForStudent({ tenantId: ctx.tenantId, studentId: student.id }),
    listTrainingPlansForTenant({ tenantId: ctx.tenantId }),
    listAssessmentsForStudent({ tenantId: ctx.tenantId, studentId: student.id }),
  ]);

  return (
    <AppShell title={student.displayName} navItems={PERSONAL_NAV_ITEMS} activeKey="alunos" trailing={<LogoutButton />}>
      <Link href="/painel/alunos" className={styles.backLink}>
        ← Voltar para a lista
      </Link>

      <Card title="Dados do aluno">
        <p className={styles.statusLine}>
          Status:{" "}
          <span className={student.status === "ATIVO" ? styles.statusAtivo : styles.statusInativo}>
            {student.status === "ATIVO" ? "Ativo" : "Inativo"}
          </span>
        </p>
        <EditarAlunoForm
          studentId={student.id}
          initialName={student.displayName}
          initialEmail={student.email}
          emailEditavel={podeEditarEmail}
        />
      </Card>

      {student.status === "ATIVO" ? (
        <Card title="Acesso e convite">
          <ConviteSection studentId={student.id} accessStatus={accessStatus} diasRestantes={diasRestantes} />
        </Card>
      ) : null}

      <Card title="Programa de treino">
        <PlanoDoAlunoSection
          studentId={student.id}
          activeAssignment={
            activeAssignment
              ? { planName: activeAssignment.trainingPlan.name, assignedAt: activeAssignment.assignedAt.toISOString() }
              : null
          }
          hasEndedAssignments={endedAssignments.length > 0}
          availablePlans={availablePlans.map((plan) => ({ id: plan.id, name: plan.name }))}
        />
      </Card>

      <Card title="Avaliações e evolução">
        <AvaliacoesSection
          studentId={student.id}
          assessments={assessments.map((assessment) => ({
            id: assessment.id,
            recordedAt: assessment.recordedAt.toISOString(),
            weightKg: assessment.weightGrams !== null ? assessment.weightGrams / 1000 : null,
            bodyFatPercent: assessment.bodyFatTenthPercent !== null ? assessment.bodyFatTenthPercent / 10 : null,
            notes: assessment.notes,
            measurements: assessment.measurements.map((m) => ({ type: m.type, valueCm: m.valueMillimeters / 10 })),
          }))}
        />
      </Card>

      <Card title="Ciclo de vida">
        {student.status === "ATIVO" ? (
          <Button href={`/painel/alunos/${student.id}/inativar`} variant="outlined">
            Inativar aluno
          </Button>
        ) : (
          <ReativarAlunoButton studentId={student.id} />
        )}
      </Card>
    </AppShell>
  );
}
