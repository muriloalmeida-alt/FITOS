import type { ReactNode } from "react";
import { getServerSession } from "@/modules/identity/session";
import { AccountNameProvider } from "@/shared/ui/AccountContext";
import { prisma } from "@/shared/db/prisma";
import { subscriptionAccess } from "@/modules/billing/access";
import { RememberAccount } from "./RememberAccount";
import { SubscriptionGate } from "./SubscriptionGate";
import { unreadTopicsCount } from "@/modules/messages/messages";

/// Layout de `/painel/*` (AjustesTelas, 29/09/2026): só disponibiliza o nome
/// real da sessão ao avatar do cabeçalho mobile do `AppShell`. Nenhuma
/// decisão de autenticação/papel acontece aqui — cada página continua
/// validando a sessão e o papel no servidor, exatamente como antes.
/// EPIC-38: para o dono do espaço (personal ou Livre) com o teste grátis
/// encerrado sem cartão, a faixa de carência ou o bloqueio.
export default async function PainelLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession();
  const user = session?.user as { name: string; email: string; role?: string } | undefined;
  const role = user?.role === "ALUNO" || user?.role === "INDIVIDUAL" || user?.role === "ADMIN" ? user.role : "PERSONAL";
  const tenant =
    session && (role === "PERSONAL" || role === "INDIVIDUAL")
      ? await prisma.tenant.findUnique({ where: { ownerId: session.user.id }, select: { saasSubscription: { include: { plan: { select: { priceCents: true } } } } } })
      : null;
  const access = subscriptionAccess(tenant?.saasSubscription ?? null, new Date());
  // EPIC-39: ponto de "não lidas" no item Mensagens.
  const unreadMessages = await unreadForSession(session?.user.id ?? null, role);
  const content =
    access.kind === "LIBERADO" ? children : (
      <SubscriptionGate state={{ kind: access.kind, dateIso: (access.kind === "CARENCIA" ? access.blockOn : access.since).toISOString() }} personal={role === "PERSONAL"}>
        {children}
      </SubscriptionGate>
    );
  return (
    <AccountNameProvider name={session?.user.name ?? null} image={session?.user.image ?? null} unreadMessages={unreadMessages}>
      <RememberAccount account={user ? { name: user.name, email: user.email, role } : null} />
      {content}
    </AccountNameProvider>
  );
}

async function unreadForSession(userId: string | null, role: string): Promise<number> {
  if (!userId) return 0;
  if (role === "PERSONAL") {
    const tenant = await prisma.tenant.findUnique({ where: { ownerId: userId }, select: { id: true } });
    return tenant ? unreadTopicsCount({ role: "PERSONAL", userId, tenantId: tenant.id }) : 0;
  }
  if (role === "ALUNO") {
    const student = await prisma.student.findUnique({ where: { userId }, select: { id: true, tenantId: true, status: true } });
    return student && student.status === "ATIVO" ? unreadTopicsCount({ role: "ALUNO", userId, tenantId: student.tenantId, studentId: student.id }) : 0;
  }
  return 0;
}
