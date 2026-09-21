import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { appName } from "@/shared/config/env";
import { AppShell, Button, Card } from "@/shared/ui";
import { formatCentsBRL } from "@/shared/lib/money";
import { AuthError, requirePersonal } from "@/modules/tenancy/authContext";
import { listStudents } from "@/modules/students/students";
import { getFinancialSummary, listActiveRecurrencesForTenant, listChargesForTenant } from "@/modules/student-finance/charges";
import { LogoutButton } from "../LogoutButton";
import { PERSONAL_NAV_ITEMS } from "../navigation";
import { FinanceiroSection } from "./FinanceiroSection";
import { RecorrenciasSection } from "./RecorrenciasSection";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: `Financeiro — ${appName}`,
};

interface FinanceiroPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/// "YYYY-MM" (formato do `<input type="month">`) → primeiro dia daquele
/// mês em UTC. Mês inválido/ausente cai no mês atual — o resumo sempre
/// mostra algo, nunca uma tela em branco por falta de filtro explícito.
function referenceMonthFromParam(param: string | undefined): Date {
  if (param) {
    const match = /^(\d{4})-(\d{2})$/.exec(param);
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      if (month >= 1 && month <= 12) {
        return new Date(Date.UTC(year, month - 1, 1));
      }
    }
  }
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function monthInputValue(referenceMonth: Date): string {
  return `${referenceMonth.getUTCFullYear()}-${String(referenceMonth.getUTCMonth() + 1).padStart(2, "0")}`;
}

/// Página "Financeiro" do shell do personal (FIT-050/053), protegida por
/// `requirePersonal()` — mesma camada de autorização de toda a aplicação.
/// "Visão geral" e a lista de cobranças compartilham o mesmo filtro de
/// competência explícito (`?mes=YYYY-MM`, `CRITICAL-SCREEN-SPECS.md`
/// seção 7) — nunca dois filtros independentes na mesma tela.
export default async function FinanceiroPage({ searchParams }: FinanceiroPageProps) {
  let ctx;
  try {
    ctx = await requirePersonal();
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    }
    throw error;
  }

  const params = await searchParams;
  const referenceMonth = referenceMonthFromParam(firstValue(params.mes));

  const [studentsResult, summary, charges, recurrences] = await Promise.all([
    listStudents({ tenantId: ctx.tenantId, status: "ATIVO", pageSize: 100 }),
    getFinancialSummary({ tenantId: ctx.tenantId, referenceMonth }),
    listChargesForTenant({ tenantId: ctx.tenantId, referenceMonth }),
    listActiveRecurrencesForTenant({ tenantId: ctx.tenantId }),
  ]);

  const students = studentsResult.items.map((s) => ({ id: s.id, displayName: s.displayName }));

  return (
    <AppShell title="Financeiro" navItems={PERSONAL_NAV_ITEMS} activeKey="financeiro" trailing={<LogoutButton />}>
      <Card title="Visão geral">
        <form method="GET" className={styles.filterForm} aria-label="Filtrar competência">
          <label className={styles.filterLabel} htmlFor="mes">
            Competência
          </label>
          <input id="mes" name="mes" type="month" defaultValue={monthInputValue(referenceMonth)} className={styles.filterInput} />
          <Button type="submit" variant="outlined">
            Filtrar
          </Button>
        </form>

        <dl className={styles.summaryGrid}>
          <div className={styles.summaryTile}>
            <dt>Previsto</dt>
            <dd>{formatCentsBRL(summary.previstoCents)}</dd>
          </div>
          <div className={styles.summaryTile} data-tone="positive">
            <dt>Recebido</dt>
            <dd>{formatCentsBRL(summary.recebidoCents)}</dd>
          </div>
          <div className={styles.summaryTile}>
            <dt>Pendente</dt>
            <dd>{formatCentsBRL(summary.pendenteCents)}</dd>
          </div>
          <div className={styles.summaryTile} data-tone="negative">
            <dt>Atrasado — exige ação</dt>
            <dd>{formatCentsBRL(summary.atrasadoCents)}</dd>
          </div>
        </dl>
      </Card>

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
