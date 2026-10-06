import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionRow, AppShell, Avatar, ProgressBar, Tag, type TagTone } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { AuthError, requirePersonal } from "@/modules/tenancy/authContext";
import { getSubscriptionForTenant } from "@/modules/billing/subscriptions";
import { listStudentRoster, type RosterFilter, type RosterRow } from "@/modules/students/roster";
import { riskCount } from "@/modules/students/riskPanel";
import { FilterLinks } from "../_workout-builder/FilterLinks";
import { LogoutButton } from "../LogoutButton";
import { PERSONAL_NAV_ITEMS } from "../navigation";
import { InviteStudent } from "./InviteStudent";
import { RosterSearch } from "./RosterSearch";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: `Alunos — ${appName}`,
};

const STEP = 30;
const FILTERS: { key: RosterFilter; label: string }[] = [
  { key: "ativos", label: "Ativos" },
  { key: "atencao", label: "Precisam de você" },
  { key: "convites", label: "Convites" },
  { key: "inativos", label: "Inativos" },
  { key: "todos", label: "Todos" },
];

function rowTag(row: RosterRow): { label: string; tone: TagTone } | null {
  if (row.status === "INATIVO") return { label: "Inativo", tone: "muted" };
  if (row.status === "VINCULO_ENCERRADO") return { label: "Vínculo encerrado", tone: "muted" };
  if (row.hasOverdueCharge) return { label: "Cobrança atrasada", tone: "error" };
  if (row.accessStatus === "CONVITE_EXPIRADO") return { label: "Convite expirado", tone: "warn" };
  if (row.accessStatus === "CONVITE_CANCELADO") return { label: "Convite cancelado", tone: "warn" };
  if (row.accessStatus === "CONVITE_PENDENTE") return { label: "Convite pendente", tone: "muted" };
  if (row.accessStatus === "NAO_CONVIDADO") return { label: "Sem convite", tone: "muted" };
  if (!row.activePlanName) return { label: "Sem programa", tone: "warn" };
  return null;
}

function rowMeta(row: RosterRow, now: Date): string {
  if (row.status !== "ATIVO") return row.email;
  const parts: string[] = [];
  if (row.activePlanName) parts.push(row.planWeek && row.planWeeks ? `${row.activePlanName} · semana ${row.planWeek} de ${row.planWeeks}` : row.activePlanName);
  else parts.push("Sem programa");
  if (row.lastSessionAt) {
    const days = Math.floor((now.getTime() - row.lastSessionAt.getTime()) / 86_400_000);
    parts.push(days <= 0 ? "treinou hoje" : days === 1 ? "treinou ontem" : `último treino há ${days} dias`);
  }
  return parts.join(" · ");
}

interface AlunosPageProps {
  searchParams?: Promise<{ filtro?: string; q?: string; limite?: string; novo?: string }>;
}

/// Alunos do Personal (FIT-144, P2 do protótipo): convite em um passo,
/// busca, filtros com contagem (Ativos, Precisam de você, Convites,
/// Inativos, Todos) e cada aluno com status e aderência da semana.
export default async function AlunosPage({ searchParams }: AlunosPageProps = {}) {
  let ctx;
  try {
    ctx = await requirePersonal();
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    }
    throw error;
  }

  const sp = (await searchParams) ?? {};
  const filter = FILTERS.some((item) => item.key === sp.filtro) ? (sp.filtro as RosterFilter) : "ativos";
  const limit = Math.max(STEP, Math.min(500, Number(sp.limite) || STEP));
  const now = new Date();
  const [roster, subscription, risk] = await Promise.all([
    listStudentRoster({ tenantId: ctx.tenantId, filter, search: sp.q, limit, now }),
    getSubscriptionForTenant(ctx.tenantId),
    riskCount(ctx.tenantId),
  ]);
  const studentLimit = subscription?.plan.studentLimit ?? null;
  const active = roster.counts.ativos;
  const capacity = subscription ? (studentLimit ? `${subscription.plan.name} · ${Math.max(0, studentLimit - active)} vagas livres` : `${subscription.plan.name} · alunos sem limite`) : undefined;
  const base = (changes: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ filtro: filter === "ativos" ? undefined : filter, q: sp.q, ...changes })) if (value) params.set(key, value);
    return params.toString() ? `/painel/alunos?${params}` : "/painel/alunos";
  };

  return (
    <AppShell eyebrow="Alunos" title={`${active} ${active === 1 ? "aluno ativo" : "alunos ativos"}`} subtitle={capacity} navItems={PERSONAL_NAV_ITEMS} activeKey="alunos" trailing={<LogoutButton />}>
      <div className={styles.next}>
        <InviteStudent startOpen={sp.novo === "1"} />
      </div>
      {risk.total > 0 ? (
        <ActionRow
          href="/painel/alunos/risco"
          title={
            <>
              {risk.total} {risk.total === 1 ? "aluno em risco" : "alunos em risco"} {risk.alto ? <Tag tone="error">{risk.alto} alto</Tag> : null}
            </>
          }
          description="Parou de treinar, atrasou ou ficou sem resposta"
          trailing={<span aria-hidden="true">›</span>}
        />
      ) : null}
      <RosterSearch />
      <FilterLinks label="Filtrar alunos" items={FILTERS.map((item) => ({ label: `${item.label} · ${roster.counts[item.key]}`, href: base({ filtro: item.key === "ativos" ? undefined : item.key }), active: item.key === filter }))} />

      {roster.rows.length === 0 ? (
        <p className={styles.empty}>{sp.q ? "Ninguém com esse nome ou e-mail." : filter === "atencao" ? "Ninguém precisa de você agora. Bom sinal." : "Nenhum aluno aqui ainda."}</p>
      ) : (
        <ul className={styles.list} aria-label="Lista de alunos">
          {roster.rows.map((row) => {
            const tag = rowTag(row);
            const percent = row.weekTarget ? (100 * Math.min(row.weekDone, row.weekTarget)) / row.weekTarget : null;
            return (
              <li key={row.id}>
                <ActionRow
                  href={`/painel/alunos/${row.id}`}
                  leading={<Avatar name={row.displayName} src={row.image ?? null} />}
                  title={
                    <>
                      {row.displayName} {tag ? <Tag tone={tag.tone}>{tag.label}</Tag> : null}
                    </>
                  }
                  description={
                    <>
                      {rowMeta(row, now)}
                      {percent !== null ? (
                        <span className={styles.week}>
                          <ProgressBar value={percent} label={`Semana de ${row.displayName}`} valueText={`${row.weekDone} de ${row.weekTarget} treinos`} />
                          <span>
                            {row.weekDone}/{row.weekTarget} na semana
                          </span>
                        </span>
                      ) : null}
                    </>
                  }
                  trailing={<span aria-hidden="true">›</span>}
                />
              </li>
            );
          })}
        </ul>
      )}
      {roster.total > roster.rows.length ? (
        <Link href={base({ limite: String(limit + STEP) })} className={styles.more}>
          Carregar mais ({roster.total - roster.rows.length})
        </Link>
      ) : null}
    </AppShell>
  );
}
