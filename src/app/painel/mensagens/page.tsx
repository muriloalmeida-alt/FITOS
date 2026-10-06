import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { prisma } from "@/shared/db/prisma";
import { AuthError } from "@/modules/tenancy/authContext";
import { listTopics, requireChatViewer, studentExercises } from "@/modules/messages/messages";
import { LogoutButton } from "../LogoutButton";
import { ALUNO_NAV_ITEMS, PERSONAL_NAV_ITEMS } from "../navigation";
import { Inbox } from "./Inbox";

export const metadata: Metadata = { title: `Mensagens — ${appName}` };

/// Mensagens (EPIC-39): os assuntos entre aluno e personal, não lidos
/// primeiro. `?categoria=` filtra; `?aluno=` (personal) mostra um aluno;
/// `?nova=1` abre a nova mensagem.
export default async function MensagensPage({ searchParams }: { searchParams?: Promise<{ categoria?: string; aluno?: string; nova?: string }> } = {}) {
  let viewer;
  try {
    viewer = await requireChatViewer();
  } catch (error) {
    if (error instanceof AuthError) redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    throw error;
  }
  const sp = (await searchParams) ?? {};
  const personal = viewer.role === "PERSONAL";
  const [topics, students, exercises, coach] = await Promise.all([
    listTopics(viewer, { category: sp.categoria ?? null, studentId: sp.aluno ?? null }),
    personal ? prisma.student.findMany({ where: { tenantId: viewer.tenantId, status: "ATIVO" }, orderBy: { displayName: "asc" }, select: { id: true, displayName: true } }) : [],
    viewer.role === "ALUNO" ? studentExercises({ tenantId: viewer.tenantId, studentId: viewer.studentId }) : [],
    personal ? null : prisma.tenant.findUniqueOrThrow({ where: { id: viewer.tenantId }, select: { owner: { select: { name: true } } } }),
  ]);
  const focused = personal && sp.aluno ? (students.find((student) => student.id === sp.aluno) ?? null) : null;

  return (
    <AppShell eyebrow="Mensagens" title={focused ? focused.displayName : personal ? "Seus alunos" : `Fale com ${coach!.owner.name.trim().split(/\s+/)[0]}`} navItems={personal ? PERSONAL_NAV_ITEMS : ALUNO_NAV_ITEMS} activeKey="mensagens" trailing={<LogoutButton />}>
      <Inbox
        role={viewer.role}
        topics={topics.map((topic) => ({ ...topic, lastMessageAt: topic.lastMessageAt.toISOString() }))}
        category={sp.categoria ?? null}
        studentId={focused?.id ?? null}
        students={students.map((student) => ({ id: student.id, name: student.displayName }))}
        exercises={exercises}
        startNew={sp.nova === "1"}
      />
    </AppShell>
  );
}
