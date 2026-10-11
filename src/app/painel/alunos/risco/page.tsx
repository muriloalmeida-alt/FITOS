import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell, Avatar, Tag } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { AuthError, requirePersonal } from "@/modules/tenancy/authContext";
import { getRiskPanel } from "@/modules/students/riskPanel";
import { LogoutButton } from "../../LogoutButton";
import { PERSONAL_NAV_ITEMS } from "../../navigation";
import styles from "./Risco.module.css";

export const metadata: Metadata = { title: `Alunos em risco — ${appName}` };

/// Painel de risco (EPIC-43): quem pode estar indo embora, o porquê e a
/// ação a um toque. Risco alto primeiro.
export default async function RiscoPage() {
  let ctx;
  try {
    ctx = await requirePersonal();
  } catch (error) {
    if (error instanceof AuthError) redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    throw error;
  }
  const rows = await getRiskPanel({ tenantId: ctx.tenantId });
  const high = rows.filter((row) => row.level === "alto").length;

  return (
    <AppShell
      eyebrow="Alunos"
      title="Em risco"
      subtitle={rows.length === 0 ? undefined : `${rows.length} ${rows.length === 1 ? "aluno" : "alunos"}${high ? ` · ${high} com risco alto` : ""}`}
      navItems={PERSONAL_NAV_ITEMS}
      activeKey="alunos"
      trailing={<LogoutButton />}
    >
      <Link href="/painel/alunos" className={styles.back}>
        ← Alunos
      </Link>
      {rows.length === 0 ? (
        <p className={styles.empty}>Ninguém em risco agora: todos treinando, em dia e com resposta. Bom sinal.</p>
      ) : (
        <ul className={styles.list} aria-label="Alunos em risco">
          {rows.map((row) => (
            <li key={row.studentId} className={styles.card}>
              <div className={styles.head}>
                <Link href={`/painel/alunos/${row.studentId}`} className={styles.who}>
                  <Avatar name={row.name} src={row.image} />
                  <strong>{row.name}</strong>
                </Link>
                <Tag tone={row.level === "alto" ? "error" : "warn"}>{row.level === "alto" ? "Risco alto" : "Atenção"}</Tag>
              </div>
              <ul className={styles.signals}>
                {row.signals.map((signal) => (
                  <li key={signal.kind}>{signal.label}</li>
                ))}
              </ul>
              <div className={styles.actions}>
                <Link href={row.action.href} className={styles.primary}>
                  {row.action.label}
                </Link>
                {row.action.label !== "Mensagem" && row.action.label !== "Responder" ? (
                  <Link href={`/painel/mensagens?aluno=${row.studentId}&nova=1`} className={styles.secondary}>
                    Mensagem
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className={styles.note}>
        Sinais: sem treinar há 10+ dias, treinando menos da metade do normal, mensalidade atrasada, programa no fim e mensagem sem resposta há 24 h+.
      </p>
    </AppShell>
  );
}
