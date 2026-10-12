import Link from "next/link";
import { AppShell, NextStepCard } from "@/shared/ui";
import type { PersonalFeedItem } from "@/modules/students/personalFeed";
import { DecisionQueue } from "./DecisionQueue";
import { HomeBanner } from "./HomeBanner";
import { NoticeRow } from "./_panel/NoticeRow";
import { TodayAgenda, type TodayClass } from "./TodayAgenda";
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
  /// Progressão (EPIC-44): alunos prontos para subir a carga.
  progressionStudents?: number;
  /// Agenda de hoje (EPIC-48): as aulas do dia e a hora atual (minutos,
  /// horário de Brasília).
  agendaToday?: { classes: TodayClass[]; nowMinutes: number } | null;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/// Início do Personal (EPIC-29): faixa da assinatura, dois indicadores que
/// levam às telas certas e a fila "Pede você agora" (uma decisão por vez,
/// resolvida no lugar), mais o botão + para o resto. Tudo vem das
/// consultas reais do tenant.
export function PersonalHome({ name, greeting, dateLabel, banner, stats, feed, isNewSpace, progressionStudents = 0, agendaToday = null }: PersonalHomeProps) {
  const studentsHint = stats.studentLimit ? `de ${stats.studentLimit} do plano` : stats.activeStudents === 1 ? "aluno ativo" : "alunos ativos";

  return (
    <AppShell eyebrow={dateLabel} title={`${greeting}, ${firstName(name)}.`} headerMode="mobile" navItems={PERSONAL_NAV_ITEMS} activeKey="inicio" trailing={<LogoutButton />} compact>
      {banner ? <HomeBanner banner={banner} /> : null}

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
      </ul>

      {isNewSpace ? (
        <section className={styles.section} aria-labelledby="primeiro-passo">
          <h2 id="primeiro-passo" className={styles.sectionTitle}>
            Primeiro passo
          </h2>
          <NextStepCard eyebrow="Comece por aqui" title="Seu primeiro aluno" description="Convite, programa e mensalidade em um minuto." href="/painel/primeiros-passos" icon="none" />
        </section>
      ) : (
        <>
          {/* Ordem do dia: aulas de hoje, a fila "Pede você agora" e, por
              último, um aviso numa linha (progressão). O risco de
              evasão já aparece na fila e na tela de Alunos. */}
          {agendaToday ? <TodayAgenda classes={agendaToday.classes} nowMinutes={agendaToday.nowMinutes} /> : null}
          <DecisionQueue items={feed.items} total={feed.total} />
          {progressionStudents > 0 ? (
            <NoticeRow eyebrow="Progressão" text={`${progressionStudents} ${progressionStudents === 1 ? "aluno pronto" : "alunos prontos"} para subir a carga`} href="/painel/alunos/progressao" />
          ) : null}
        </>
      )}
    </AppShell>
  );
}
