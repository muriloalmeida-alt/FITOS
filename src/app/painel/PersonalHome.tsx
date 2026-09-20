import Link from "next/link";
import { AppShell, Button, Card } from "@/shared/ui";
import { formatCentsBRL } from "@/shared/lib/money";
import { LogoutButton } from "./LogoutButton";
import { PERSONAL_NAV_ITEMS } from "./navigation";
import styles from "./PersonalHome.module.css";

interface PersonalHomeProps {
  name: string;
  email: string;
  tenantName: string | null;
  activeStudentsCount: number;
  activeWorkoutsCount: number;
  atrasadoCents: number;
}

/// Painel operacional do personal (FIT-060): alunos ativos, treinos e
/// situação financeira consolidados, com atalhos diretos para as ações
/// principais. Nenhuma entidade nova — composição/leitura sobre o que já
/// existe (alunos, treinos, financeiro).
export function PersonalHome({ name, email, tenantName, activeStudentsCount, activeWorkoutsCount, atrasadoCents }: PersonalHomeProps) {
  return (
    <AppShell
      title="Início"
      subtitle={`Olá, ${name}`}
      navItems={PERSONAL_NAV_ITEMS}
      activeKey="inicio"
      trailing={<LogoutButton />}
    >
      <Card title="Visão geral">
        <dl className={styles.statsGrid}>
          <div className={styles.statTile}>
            <dt>Alunos ativos</dt>
            <dd>{activeStudentsCount}</dd>
          </div>
          <div className={styles.statTile}>
            <dt>Treinos ativos</dt>
            <dd>{activeWorkoutsCount}</dd>
          </div>
          <div className={styles.statTile} data-tone={atrasadoCents > 0 ? "negative" : undefined}>
            <dt>Atrasado este mês</dt>
            <dd>{formatCentsBRL(atrasadoCents)}</dd>
          </div>
        </dl>

        <div className={styles.shortcuts}>
          <Link href="/painel/alunos/novo">
            <Button type="button" variant="filled">
              + Novo aluno
            </Button>
          </Link>
          <Link href="/painel/treinos/novo">
            <Button type="button" variant="outlined">
              + Novo treino
            </Button>
          </Link>
          <Link href="/painel/financeiro">
            <Button type="button" variant="outlined">
              Ver financeiro
            </Button>
          </Link>
        </div>
      </Card>

      <Card title="Sua sessão">
        <p>
          E-mail: <strong>{email}</strong>
        </p>
        <p>
          Papel: <strong>Personal</strong>
        </p>
      </Card>

      {tenantName ? (
        <Card title="Seu espaço">
          <p>
            Nome: <strong>{tenantName}</strong>
          </p>
        </Card>
      ) : null}
    </AppShell>
  );
}
