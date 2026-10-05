import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { prisma } from "@/shared/db/prisma";
import { AuthError, requirePersonal } from "@/modules/tenancy/authContext";
import { getInviteDefaults, getOrCreateInviteCode } from "@/modules/students/inviteLink";
import { getLibrary } from "@/modules/library/library";
import { LogoutButton } from "../LogoutButton";
import { PERSONAL_NAV_ITEMS } from "../navigation";
import { FirstSteps } from "./FirstSteps";

export const metadata: Metadata = { title: `Primeiro aluno — ${appName}` };

const FEATURED = ["Corpo todo 3× · 45 min", "Divisão ABC · 60 min", "Emagrecimento · 45 min", "Corpo todo 3× · 30 min"];

/// Primeiros minutos do personal (EPIC-33, E4): em vez de formulário, o
/// primeiro resultado — mandar o convite, escolher o programa que vai
/// junto e combinar a mensalidade. Tudo resolvido no lugar; dá para pular.
export default async function PrimeirosPassosPage() {
  let ctx;
  try {
    ctx = await requirePersonal();
  } catch (error) {
    if (error instanceof AuthError) redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    throw error;
  }
  const [code, defaults, library, tenant, students] = await Promise.all([
    getOrCreateInviteCode(ctx.tenantId),
    getInviteDefaults(ctx.tenantId),
    getLibrary({ tenantId: ctx.tenantId }),
    prisma.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId }, select: { name: true, owner: { select: { name: true } } } }),
    prisma.student.count({ where: { tenantId: ctx.tenantId } }),
  ]);
  const base = (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const programs = [...library.programs].sort((a, b) => {
    const rank = (name: string) => (FEATURED.indexOf(name) === -1 ? 99 : FEATURED.indexOf(name));
    return rank(a.name) - rank(b.name);
  });

  return (
    <AppShell eyebrow={`${tenant.name} está pronto`} title="Seu primeiro aluno" navItems={PERSONAL_NAV_ITEMS} activeKey="inicio" trailing={<LogoutButton />}>
      <FirstSteps
        url={`${base}/c/${code}`}
        personalFirstName={tenant.owner.name.trim().split(/\s+/)[0] ?? tenant.owner.name}
        hasStudents={students > 0}
        programs={programs.slice(0, 4).map((program) => ({ id: program.id, name: program.name, meta: program.meta }))}
        defaults={defaults}
      />
    </AppShell>
  );
}
