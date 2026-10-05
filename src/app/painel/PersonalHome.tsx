import Link from "next/link";
import { AppShell, NextStepCard } from "@/shared/ui";
import { formatCentsBRL } from "@/shared/lib/money";
import type { PersonalFeedItem } from "@/modules/students/personalFeed";
import { DecisionQueue } from "./DecisionQueue";
import { QuickActions, type QuickCharge } from "./QuickActions";
import { LogoutButton } from "./LogoutButton";
import { PERSONAL_NAV_ITEMS } from "./navigation";
import styles from "./PersonalHome.module.css";

export interface PersonalHomeBanner {
  tone: "trial" | "ok" | "warn";
  text: string;
  cta: string;
}

export interface PersonalHomeStats {
  activeStudents: number;
  studentLimit: number | null;
  /// BK-06: % dos treinos previstos na semana já concluídos (`null` sem previsão).
  weekCompletion: number | null;
  receivedCents: number;
  overdueCount: number;
}

interface PersonalHomeProps {
  name: string;
  /// Saudação e data calculadas no servidor, no fuso do produto (FIT-137).
  greeting: string;
  dateLabel?: string;
  banner: PersonalHomeBanner | null;
  stats: PersonalHomeStats;
  feed: { items: PersonalFeedItem[]; total: number };
  /// Espaço sem nenhum aluno cadastrado: mostra o primeiro passo.
  isNewSpace: boolean;
  /// Botão + (EPIC-29): cobranças em aberto e alunos ativos.
  openCharges: QuickCharge[];
  students: { id: string; name: string }[];
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/// Início do Personal (EPIC-29): faixa da assinatura, três indicadores que
/// levam às telas certas e a fila "Pede você agora" (uma decisão por vez,
/// resolvida no lugar), mais o botão + para o resto. Tudo vem das
/// consultas reais do tenant.
export function PersonalHome({ name, greeting, dateLabel, banner, stats, feed, isNewSpace, openCharges, students }: PersonalHomeProps) {
  const studentsHint = stats.studentLimit ? `de ${stats.studentLimit} do plano` : stats.activeStudents === 1 ? "aluno ativo" : "alunos ativos";
  const moneyHint = stats.overdueCount > 0 ? `${stats.overdueCount} ${stats.overdueCount === 1 ? "atrasada" : "atrasadas"}` : "recebido no mês";

  return (
    <AppShell eyebrow={dateLabel} title={`${greeting}, ${firstName(name)}.`} headerMode="mobile" navItems={PERSONAL_NAV_ITEMS} activeKey="inicio" trailing={<LogoutButton />}>
      {banner ? (
        <Link href="/painel/assinatura" className={`${styles.banner} ${styles[`banner_${banner.tone}`]}`}>
          <span>{banner.text}</span>
          <span className={styles.bannerCta}>
            {banner.cta} <span aria-hidden="true">→</span>
          </span>
        </Link>
      ) : null}

      <ul className={styles.stats} aria-label="Resumo">
        <li>
          <Link href="/painel/alunos" className={styles.stat}>
            <span className={styles.statValue}>{stats.activeStudents}</span>
            <span className={styles.statLabel}>{studentsHint}</span>
          </Link>
        </li>
        <li>
          <Link href="/painel/alunos" className={styles.stat}>
            <span className={styles.statValue}>{stats.weekCompletion === null ? "—" : `${stats.weekCompletion}%`}</span>
            <span className={styles.statLabel}>treinos da semana</span>
          </Link>
        </li>
        <li>
          <Link href="/painel/financeiro" className={styles.stat}>
            <span className={styles.statValue}>{formatCentsBRL(stats.receivedCents).replace(/,00$/, "")}</span>
            <span className={stats.overdueCount > 0 ? `${styles.statLabel} ${styles.statDanger}` : styles.statLabel}>{moneyHint}</span>
          </Link>
        </li>
      </ul>

      {isNewSpace ? (
        <section className={styles.section} aria-labelledby="primeiro-passo">
          <h2 id="primeiro-passo" className={styles.sectionTitle}>
            Primeiro passo
          </h2>
          <NextStepCard eyebrow="Comece por aqui" title="Seu primeiro aluno" description="Convite, programa e mensalidade em um minuto." href="/painel/primeiros-passos" />
        </section>
      ) : (
        <DecisionQueue items={feed.items} total={feed.total} />
      )}
      <QuickActions charges={openCharges} students={students} />
    </AppShell>
  );
}
