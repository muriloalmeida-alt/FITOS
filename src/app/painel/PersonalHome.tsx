import Link from "next/link";
import { AppShell, Card, EvolutionMetric } from "@/shared/ui";
import { NavIcon, type NavIconName } from "@/shared/ui/NavIcon";
import { initialsFromName } from "@/shared/lib/initials";
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
  /// Data do dia já formatada no servidor (ex.: "Terça, 29 de setembro") —
  /// eyebrow do cabeçalho mobile (AjustesPainel, 29/09/2026). Opcional para
  /// manter compatibilidade com chamadas sem data.
  dateLabel?: string;
  activeStudentsCount: number;
  activeWorkoutsCount: number;
  atrasadoCents: number;
  attentionItems: PersonalAttentionEntry[];
}

interface QuickAction {
  href: string;
  label: string;
  hint: string;
  icon: NavIconName;
  primary?: boolean;
  desktopOnly?: boolean;
}

/// Acesso rápido (AjustesPainel item 4): três ações na mesma linha no
/// mobile — Novo aluno (principal, laranja), Alunos e Treinos —, sempre
/// destinos reais já existentes. "Novo treino" e "Financeiro" continuam
/// como atalhos extras só no desktop (o mobile alcança Financeiro pelo
/// menu de conta do avatar).
const QUICK_ACTIONS: QuickAction[] = [
  { href: "/painel/alunos/novo", label: "Novo aluno", hint: "Cadastrar", icon: "novo", primary: true },
  { href: "/painel/alunos", label: "Alunos", hint: "Gerenciar", icon: "alunos" },
  { href: "/painel/treinos", label: "Treinos", hint: "Organizar", icon: "treinos" },
  { href: "/painel/treinos/novo", label: "Novo treino", hint: "Criar modelo", icon: "novo", desktopOnly: true },
  { href: "/painel/financeiro", label: "Ver financeiro", hint: "Cobranças", icon: "financeiro", desktopOnly: true },
];

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/// CTA de cada linha de "Seu dia", derivado do sinal real (mensalidade
/// vencida → financeiro do aluno; avaliação → perfil/avaliações). Sempre
/// leva ao perfil real do aluno, onde as duas ações existem.
function attentionCta(item: PersonalAttentionEntry): string {
  return item.tone === "warning" ? "Ver cobrança" : "Registrar avaliação";
}

/// Painel operacional do personal (FIT-060, redesenhado na FIT-120;
/// composição mobile revista em AjustesPainel, 29/09/2026). Mobile:
/// saudação com data, "Visão geral" (dois indicadores em uma linha com
/// divisor fino), "Acesso rápido" (três ações circulares) e "Seu dia"
/// (pendências reais em linhas com avatar de iniciais) — tudo integrado
/// ao fundo, sem cartões. Desktop mantém a tela-06 do pacote visual 2026
/// (hero fotográfico + blocos). Nenhum número, nome ou evento ilustrativo
/// das prévias é usado: tudo vem das consultas reais do tenant.
export function PersonalHome({
  name,
  email,
  tenantName,
  greeting,
  dateLabel,
  activeStudentsCount,
  activeWorkoutsCount,
  atrasadoCents,
  attentionItems,
}: PersonalHomeProps) {
  const headline = `${greeting}, ${firstName(name)}.`;

  return (
    <AppShell
      eyebrow={dateLabel}
      title={headline}
      subtitle="Seu trabalho em movimento."
      headerMode="mobile"
      navItems={PERSONAL_NAV_ITEMS}
      activeKey="inicio"
      trailing={<LogoutButton />}
    >
      <div className={styles.desktopOnly}>
        <PersonalHero greeting={headline} activeStudentsCount={activeStudentsCount} activeWorkoutsCount={activeWorkoutsCount} />
      </div>

      <section className={styles.section} aria-labelledby="visao-geral">
        <h2 id="visao-geral" className={styles.sectionTitle}>
          Visão geral
        </h2>
        <div className={styles.metricsRow}>
          <div className={styles.metric}>
            <span className={styles.metricValue}>{activeStudentsCount}</span>
            <span className={styles.metricLabel}>{activeStudentsCount === 1 ? "aluno ativo" : "alunos ativos"}</span>
          </div>
          <div className={`${styles.metric} ${styles.metricAccent}`}>
            <span className={styles.metricValue}>{activeWorkoutsCount}</span>
            <span className={styles.metricLabel}>{activeWorkoutsCount === 1 ? "treino ativo" : "treinos ativos"}</span>
          </div>
          <div className={`${styles.desktopOnlyBlock} ${styles.metricWide}`}>
            <EvolutionMetric value={formatCentsBRL(atrasadoCents)} label="Atrasado este mês" />
          </div>
        </div>
        {activeStudentsCount === 0 ? (
          <p className={styles.emptyHint}>Comece cadastrando seu primeiro aluno para acompanhar a evolução dele por aqui.</p>
        ) : null}
      </section>

      <section className={styles.section} aria-labelledby="acesso-rapido">
        <h2 id="acesso-rapido" className={styles.sectionTitle}>
          Acesso rápido
        </h2>
        <ul className={styles.quickActions}>
          {QUICK_ACTIONS.map((action) => (
            <li key={action.href} className={action.desktopOnly ? styles.desktopOnlyBlock : undefined}>
              <Link href={action.href} className={styles.quickAction}>
                <span className={action.primary ? `${styles.quickIcon} ${styles.quickIconPrimary}` : styles.quickIcon} aria-hidden="true">
                  <NavIcon name={action.icon} />
                </span>
                <span className={styles.quickLabel}>{action.label}</span>{" "}
                <span className={styles.quickHint}>{action.hint}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="seu-dia">
        <h2 id="seu-dia" className={styles.sectionTitle}>
          Seu dia
        </h2>
        <p className={styles.sectionHint}>O que precisa de atenção agora.</p>
        {attentionItems.length > 0 ? (
          <ul className={styles.dayList}>
            {attentionItems.map((item) => (
              <li key={item.studentId}>
                <Link href={`/painel/alunos/${item.studentId}`} className={styles.dayRow}>
                  <span className={item.tone === "warning" ? `${styles.dayAvatar} ${styles.dayAvatarWarning}` : styles.dayAvatar} aria-hidden="true">
                    {initialsFromName(item.title)}
                  </span>
                  <span className={styles.dayText}>
                    <strong className={styles.dayTitle}>{item.title}</strong>{" "}
                    <span className={styles.dayDescription}>{item.description}</span>{" "}
                    <span className={styles.dayCta}>
                      {attentionCta(item)} <span aria-hidden="true">→</span>
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.dayEmpty}>Nada pendente por aqui. Mensalidades vencidas e avaliações atrasadas dos seus alunos aparecem nesta lista.</p>
        )}
      </section>

      <div className={styles.desktopOnly}>
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
      </div>
    </AppShell>
  );
}
