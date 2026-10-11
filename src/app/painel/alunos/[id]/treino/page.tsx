import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AppShell, Button } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { AuthError, requirePersonal } from "@/modules/tenancy/authContext";
import { getStudentForTenant } from "@/modules/students/students";
import { getStudentCopy } from "@/modules/library/studentCopy";
import { prisma } from "@/shared/db/prisma";
import { LogoutButton } from "../../../LogoutButton";
import { PERSONAL_NAV_ITEMS } from "../../../navigation";
import { CopyEditor } from "./CopyEditor";

export const metadata: Metadata = { title: `Treino do aluno — ${appName}` };

/// Cópia do aluno (EPIC-28): o programa que o aluno recebeu, para ajustar
/// só para ele. Tocar no exercício abre outros do mesmo grupo muscular.
export default async function StudentCopyPage({ params }: { params: Promise<{ id: string }> }) {
  let ctx;
  try {
    ctx = await requirePersonal();
  } catch (error) {
    if (error instanceof AuthError) redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    throw error;
  }
  const { id } = await params;
  const student = await getStudentForTenant({ tenantId: ctx.tenantId, studentId: id });
  if (!student) notFound();
  const first = student.displayName.trim().split(/\s+/)[0] ?? student.displayName;
  const [copy, cardio] = await Promise.all([
    getStudentCopy({ tenantId: ctx.tenantId, studentId: id }),
    prisma.exercise.findMany({ where: { type: "Aeróbico", status: "ATIVO", OR: [{ tenantId: null }, { tenantId: ctx.tenantId }] }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <AppShell eyebrow={`Treino de ${first}`} title={copy?.planName ?? "Sem programa"} navItems={PERSONAL_NAV_ITEMS} activeKey="alunos" trailing={<LogoutButton />}>
      {copy ? (
        <CopyEditor studentId={id} studentFirstName={first} copy={copy} cardioOptions={cardio} />
      ) : (
        <Button href={`/painel/treinos?aluno=${id}`} block>
          Escolher na biblioteca
        </Button>
      )}
    </AppShell>
  );
}
