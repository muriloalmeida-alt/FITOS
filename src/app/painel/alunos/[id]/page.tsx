import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell, Button, Card } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { AuthError, requirePersonal } from "@/modules/tenancy/authContext";
import { getStudentForTenant } from "@/modules/students/students";
import { daysUntil, deriveAccessStatus, getLatestInvitationForStudent } from "@/modules/students/invitations";
import { LogoutButton } from "../../LogoutButton";
import { PERSONAL_NAV_ITEMS } from "../../navigation";
import { EditarAlunoForm } from "./EditarAlunoForm";
import { ReativarAlunoButton } from "./ReativarAlunoButton";
import { ConviteSection } from "./ConviteSection";
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

      <Card title="Ciclo de vida">
        {student.status === "ATIVO" ? (
          <Link href={`/painel/alunos/${student.id}/inativar`}>
            <Button type="button" variant="outlined">
              Inativar aluno
            </Button>
          </Link>
        ) : (
          <ReativarAlunoButton studentId={student.id} />
        )}
      </Card>
    </AppShell>
  );
}
