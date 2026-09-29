import { AppShell, AttentionItem, Button, Card, EvolutionMetric } from "@/shared/ui";
import { formatCentsBRL } from "@/shared/lib/money";
import type { PersonalAttentionEntry } from "./getPersonalAttentionItems";
import { LogoutButton } from "./LogoutButton";
import { PERSONAL_NAV_ITEMS } from "./navigation";
import { PersonalHero } from "./PersonalHero";
import styles from "./PersonalHome.module.css";

interface PersonalHomeProps {
  name: string;
  email: string;
  tenantName: string | null;
  /// Saudação real conforme a hora do request no servidor (FIT-137) —
  /// "Bom dia"/"Boa tarde"/"Boa noite", nunca calculada no cliente (evitaria
  /// divergir do fuso do servidor na primeira renderização).
  greeting: string;
  activeStudentsCount: number;
  activeWorkoutsCount: number;
  atrasadoCents: number;
  attentionItems: PersonalAttentionEntry[];
}

/// Painel operacional do personal (FIT-060, redesenhado na FIT-120):
/// alunos ativos, treinos e situação financeira consolidados, com atalhos
/// diretos para as ações principais e a lista "Precisa de atenção"
/// (mensalidade vencida/avaliação atrasada, `getPersonalAttentionItems`).
/// Nenhuma entidade nova — composição/leitura sobre o que já existe
/// (alunos, treinos, financeiro, avaliações).
export function PersonalHome({
  name,
  email,
  tenantName,
  greeting,
  activeStudentsCount,
  activeWorkoutsCount,
  atrasadoCents,
  attentionItems,
}: PersonalHomeProps) {
  return (
    <AppShell
      title="Início"
      subtitle={`Olá, ${name}`}
      navItems={PERSONAL_NAV_ITEMS}
      activeKey="inicio"
      trailing={<LogoutButton />}
    >
      <PersonalHero
        greeting={`${greeting}, ${name}.`}
        activeStudentsCount={activeStudentsCount}
        activeWorkoutsCount={activeWorkoutsCount}
      />

      {attentionItems.length > 0 ? (
        <Card title="Precisa de atenção">
          <div className={styles.attentionList}>
            {attentionItems.map((item) => (
              <AttentionItem
                key={item.studentId}
                icon={item.icon}
                title={item.title}
                description={item.description}
                tone={item.tone}
                href={`/painel/alunos/${item.studentId}`}
              />
            ))}
          </div>
        </Card>
      ) : null}

      <Card title="Visão geral">
        <div className={styles.metricsGrid}>
          <EvolutionMetric value={String(activeStudentsCount)} label="Alunos ativos" />
          <EvolutionMetric value={String(activeWorkoutsCount)} label="Treinos ativos" />
          <EvolutionMetric value={formatCentsBRL(atrasadoCents)} label="Atrasado este mês" />
        </div>

        {activeStudentsCount === 0 ? (
          <p className={styles.emptyHint}>Comece cadastrando seu primeiro aluno para acompanhar a evolução dele por aqui.</p>
        ) : null}

        <div className={styles.shortcuts}>
          <Button href="/painel/alunos/novo" variant="filled">
            + Novo aluno
          </Button>
          <Button href="/painel/treinos/novo" variant="outlined">
            + Novo treino
          </Button>
          <Button href="/painel/financeiro" variant="outlined">
            Ver financeiro
          </Button>
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
