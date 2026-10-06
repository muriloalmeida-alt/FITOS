import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell, Button } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { AuthError, requirePersonal } from "@/modules/tenancy/authContext";
import { getStudentForTenant } from "@/modules/students/students";
import { getHealthForm } from "@/modules/students/healthForm";
import { LogoutButton } from "../../../LogoutButton";
import { PERSONAL_NAV_ITEMS } from "../../../navigation";
import { HealthFormEditor } from "../../../_health/HealthFormEditor";
import { HealthSummary } from "../../../_health/HealthSummary";
import styles from "../../risco/Risco.module.css";

export const metadata: Metadata = { title: `Ficha de saúde — ${appName}` };

/// Ficha de saúde do aluno para o personal (EPIC-46): ler, preencher pelo
/// aluno ou pedir por mensagem.
export default async function SaudeAlunoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ editar?: string }> }) {
  let ctx;
  try {
    ctx = await requirePersonal();
  } catch (error) {
    if (error instanceof AuthError) redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    throw error;
  }
  const student = await getStudentForTenant({ tenantId: ctx.tenantId, studentId: (await params).id });
  if (!student) notFound();
  const sp = (await searchParams) ?? {};
  const form = await getHealthForm({ tenantId: ctx.tenantId, studentId: student.id });
  const first = student.displayName.trim().split(/\s+/)[0];
  const editing = sp.editar === "1";

  return (
    <AppShell eyebrow="Ficha de saúde" title={student.displayName} navItems={PERSONAL_NAV_ITEMS} activeKey="alunos" trailing={<LogoutButton />}>
      <Link href={`/painel/alunos/${student.id}`} className={styles.back}>
        ← {first}
      </Link>
      {editing ? (
        <HealthFormEditor initial={form?.answers ?? null} endpoint={`/api/students/${student.id}/ficha-saude`} doneHref={`/painel/alunos/${student.id}/saude`} forStudent={student.displayName} />
      ) : form ? (
        <>
          <HealthSummary {...form} />
          <Button href={`/painel/alunos/${student.id}/saude?editar=1`} variant="secondary" block>
            Editar
          </Button>
        </>
      ) : (
        <>
          <p className={styles.empty}>{first} ainda não respondeu. {student.userId ? "A ficha aparece no Início do app dele." : "Quando ativar a conta, a ficha aparece no Início do app."}</p>
          <Button href={`/painel/alunos/${student.id}/saude?editar=1`} block>
            Preencher por {first}
          </Button>
          {student.userId ? (
            <Button href={`/painel/mensagens?aluno=${student.id}&nova=1`} variant="secondary" block>
              Pedir por mensagem
            </Button>
          ) : null}
        </>
      )}
    </AppShell>
  );
}
