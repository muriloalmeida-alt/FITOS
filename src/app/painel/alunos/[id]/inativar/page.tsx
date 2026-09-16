import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell, Button, Card } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { AuthError, requirePersonal } from "@/modules/tenancy/authContext";
import { getStudentForTenant } from "@/modules/students/students";
import { LogoutButton } from "../../../LogoutButton";
import { PERSONAL_NAV_ITEMS } from "../../../navigation";
import { InativarAlunoButton } from "./InativarAlunoButton";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: `Inativar aluno — ${appName}`,
};

interface InativarAlunoPageProps {
  params: Promise<{ id: string }>;
}

/// Confirmação explícita antes de inativar (M3: "texto explica impacto e
/// reversibilidade", "não usar confirmação genérica 'Tem certeza?'").
export default async function InativarAlunoPage({ params }: InativarAlunoPageProps) {
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

  return (
    <AppShell title="Inativar aluno" navItems={PERSONAL_NAV_ITEMS} activeKey="alunos" trailing={<LogoutButton />}>
      <Card title={`Inativar ${student.displayName}?`}>
        <p>
          O aluno deixa de acessar o FitOS normalmente e some da lista padrão de alunos ativos, mas o histórico é
          preservado — você pode reativar a qualquer momento.
        </p>
        <div className={styles.actions}>
          <InativarAlunoButton studentId={student.id} />
          <Link href={`/painel/alunos/${student.id}`}>
            <Button type="button" variant="outlined">
              Cancelar
            </Button>
          </Link>
        </div>
      </Card>
    </AppShell>
  );
}
