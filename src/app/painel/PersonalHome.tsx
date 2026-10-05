import Link from "next/link";
import { ActionRow, AppShell, Avatar, NextStepCard, Tag, type TagTone } from "@/shared/ui";
import { NavIcon, type NavIconName } from "@/shared/ui/NavIcon";
import { formatCentsBRL } from "@/shared/lib/money";
import type { PersonalFeedItem, PersonalFeedKind } from "@/modules/students/personalFeed";
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
}

const KIND_TAG: Record<PersonalFeedKind, { label: string; tone: TagTone }> = {
  cobranca_atrasada: { label: "Cobrança", tone: "error" },
  convite_expirado: { label: "Convite", tone: "warn" },
  convite_aceito: { label: "Novo", tone: "ok" },
  sem_programa: { label: "Sem programa", tone: "warn" },
  programa_terminando: { label: "Programa", tone: "warn" },
  treino_concluido: { label: "Treinou", tone: "ok" },
  avaliacao_pendente: { label: "Avaliação", tone: "muted" },
};

const QUICK_ACTIONS: { href: string; label: string; icon: NavIconName }[] = [
  { href: "/painel/alunos?novo=1", label: "Convidar aluno", icon: "alunos" },
  { href: "/painel/treinos/novo", label: "Montar treino", icon: "treinos" },
  { href: "/painel/financeiro?nova=1", label: "Nova cobrança", icon: "financeiro" },
];

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/// Início do Personal (FIT-143, P1 do protótipo): o que precisa de você
/// hoje, com a ação a um toque. Faixa da assinatura, três indicadores que
/// levam às telas certas, feed "Acontecendo agora" (BK-05) e acesso rápido.
/// Tudo vem das consultas reais do tenant, nunca de números ilustrativos.
export function PersonalHome({ name, greeting, dateLabel, banner, stats, feed, isNewSpace }: PersonalHomeProps) {
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
            <span className={styles.statValue}>{formatCentsBRL(stats.receivedCents)}</span>
            <span className={stats.overdueCount > 0 ? `${styles.statLabel} ${styles.statDanger}` : styles.statLabel}>{moneyHint}</span>
          </Link>
        </li>
      </ul>

      {isNewSpace ? (
        <section className={styles.section} aria-labelledby="primeiro-passo">
          <h2 id="primeiro-passo" className={styles.sectionTitle}>
            Primeiro passo
          </h2>
          <NextStepCard eyebrow="Comece por aqui" title="Convide seu primeiro aluno" description="Só nome e e-mail. Depois é só atribuir um programa." href="/painel/alunos?novo=1" />
        </section>
      ) : (
        <section className={styles.section} aria-labelledby="acontecendo-agora">
          <h2 id="acontecendo-agora" className={styles.sectionTitle}>
            Acontecendo agora
          </h2>
          {feed.items.length > 0 ? (
            <ul className={styles.feed}>
              {feed.items.map((item) => {
                const tag = KIND_TAG[item.kind];
                return (
                  <li key={`${item.kind}-${item.studentId}`}>
                    <ActionRow
                      leading={<Avatar name={item.studentName} />}
                      title={
                        <>
                          {item.studentName} <Tag tone={tag.tone}>{tag.label}</Tag>
                        </>
                      }
                      description={item.description}
                      action={{ label: item.actionLabel, href: item.href }}
                    />
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={styles.empty}>Tudo em dia. Nada precisa de você agora.</p>
          )}
          {feed.total > feed.items.length ? (
            <Link href="/painel/alunos?filtro=atencao" className={styles.more}>
              Ver alunos que precisam de você
            </Link>
          ) : null}
        </section>
      )}

      <section className={styles.section} aria-labelledby="acesso-rapido">
        <h2 id="acesso-rapido" className={styles.sectionTitle}>
          Acesso rápido
        </h2>
        <ul className={styles.quick}>
          {QUICK_ACTIONS.map((action) => (
            <li key={action.href}>
              <Link href={action.href} className={styles.quickAction}>
                <span className={styles.quickIcon} aria-hidden="true">
                  <NavIcon name={action.icon} />
                </span>
                {action.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </AppShell>
  );
}
