import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { prisma } from "@/shared/db/prisma";
import { AuthError, requireSession } from "@/modules/tenancy/authContext";
import { listOccurrences, listSlots, nextOccurrencesForStudent } from "@/modules/schedule/schedule";
import { addDays, isDate, localDate, mondayOf } from "@/shared/lib/scheduleTime";
import { LogoutButton } from "../LogoutButton";
import { ALUNO_NAV_ITEMS, PERSONAL_NAV_ITEMS } from "../navigation";
import { AgendaView } from "./AgendaView";
import { StudentAgenda } from "./StudentAgenda";

export const metadata: Metadata = { title: `Agenda — ${appName}` };

/// Agenda (EPIC-48): a semana do personal ou as próximas aulas do aluno.
export default async function AgendaPage({ searchParams }: { searchParams?: Promise<{ semana?: string }> } = {}) {
  let ctx;
  try {
    ctx = await requireSession();
  } catch (error) {
    if (error instanceof AuthError) redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    throw error;
  }
  const today = localDate(new Date());

  if (ctx.role === "ALUNO" && ctx.tenantId && ctx.studentId) {
    const [occurrences, tenant] = await Promise.all([
      nextOccurrencesForStudent({ tenantId: ctx.tenantId, studentId: ctx.studentId, limit: 20 }),
      prisma.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId }, select: { owner: { select: { name: true } } } }),
    ]);
    return (
      <AppShell eyebrow="Agenda" title="Suas aulas" navItems={ALUNO_NAV_ITEMS} activeKey="agenda" trailing={<LogoutButton />}>
        <StudentAgenda occurrences={occurrences} coachName={tenant.owner.name} />
      </AppShell>
    );
  }
  if (ctx.role !== "PERSONAL") redirect("/painel");

  const sp = (await searchParams) ?? {};
  const monday = mondayOf(isDate(sp.semana) ? sp.semana : today);
  const [occurrences, students, slots] = await Promise.all([
    listOccurrences({ tenantId: ctx.tenantId, from: monday, to: addDays(monday, 6) }),
    prisma.student.findMany({ where: { tenantId: ctx.tenantId, status: "ATIVO" }, orderBy: { displayName: "asc" }, select: { id: true, displayName: true } }),
    listSlots({ tenantId: ctx.tenantId }),
  ]);
  return (
    <AppShell eyebrow="Agenda" title="Semana" navItems={PERSONAL_NAV_ITEMS} activeKey="agenda" trailing={<LogoutButton />}>
      <AgendaView
        monday={monday}
        today={today}
        occurrences={occurrences}
        students={students.map((student) => ({ id: student.id, name: student.displayName }))}
        slots={slots.map((slot) => ({ id: slot.id, studentName: slot.student.displayName, weekday: slot.weekday, startMinutes: slot.startMinutes, durationMinutes: slot.durationMinutes, location: slot.location }))}
      />
    </AppShell>
  );
}
