import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { appName } from "@/shared/config/env";
import { AppShell, Card } from "@/shared/ui";
import { AuthError, requirePersonal } from "@/modules/tenancy/authContext";
import { listStudents } from "@/modules/students/students";
import { listActiveRecurrencesForTenant, listChargesForTenant } from "@/modules/student-finance/charges";
import { LogoutButton } from "../LogoutButton";
import { PERSONAL_NAV_ITEMS } from "../navigation";
import { FinanceiroSection } from "./FinanceiroSection";
import { RecorrenciasSection } from "./RecorrenciasSection";

export const metadata: Metadata = {
  title: `Financeiro — ${appName}`,
};

/// Página "Financeiro" do shell do personal (FIT-050), protegida por
/// `requirePersonal()` — mesma camada de autorização de toda a aplicação.
export default async function FinanceiroPage() {
  let ctx;
  try {
    ctx = await requirePersonal();
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    }
    throw error;
  }

  const [studentsResult, charges, recurrences] = await Promise.all([
    listStudents({ tenantId: ctx.tenantId, status: "ATIVO", pageSize: 100 }),
    listChargesForTenant({ tenantId: ctx.tenantId }),
    listActiveRecurrencesForTenant({ tenantId: ctx.tenantId }),
  ]);

  const students = studentsResult.items.map((s) => ({ id: s.id, displayName: s.displayName }));

  return (
    <AppShell title="Financeiro" navItems={PERSONAL_NAV_ITEMS} activeKey="financeiro" trailing={<LogoutButton />}>
      <Card title="Cobranças">
        <FinanceiroSection
          students={students}
          charges={charges.map((c) => ({
            id: c.id,
            description: c.description,
            amountCents: c.amountCents,
            referenceMonth: c.referenceMonth.toISOString(),
            dueDate: c.dueDate.toISOString(),
            status: c.status,
            cancelReason: c.cancelReason,
            student: c.student,
            payment: c.payment ? { amountCentsPaid: c.payment.amountCentsPaid, paidAt: c.payment.paidAt.toISOString(), method: c.payment.method } : null,
          }))}
        />
      </Card>

      <Card title="Cobranças recorrentes">
        <RecorrenciasSection
          students={students}
          recurrences={recurrences.map((r) => ({
            id: r.id,
            description: r.description,
            amountCents: r.amountCents,
            dueDayOfMonth: r.dueDayOfMonth,
            student: r.student,
          }))}
        />
      </Card>
    </AppShell>
  );
}
