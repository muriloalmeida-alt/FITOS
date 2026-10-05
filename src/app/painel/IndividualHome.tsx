import Link from "next/link";
import { ActionRow, AppShell, Button, NextStepCard, ProgressBar, WeekStrip } from "@/shared/ui";
import type { IndividualHome as IndividualHomeData } from "@/modules/workouts/individualHome";
import { formatDays, weekStripFromDays } from "@/shared/lib/weekdays";
import { LogoutButton } from "./LogoutButton";
import { INDIVIDUAL_NAV_ITEMS } from "./navigation";
import { ProgressionCard } from "./ProgressionCard";
import styles from "./IndividualHome.module.css";

interface IndividualHomeProps {
  name: string;
  greeting: string;
  dateLabel?: string;
  home: IndividualHomeData;
  todayIso: string;
  /// EPIC-33: aviso de fim do teste sem cartão.
  trialNotice?: string | null;
}

const SESSION_HREF = "/painel/meus-treinos/sessao";

/// Início do FitOS Livre (FIT-156, L1 do protótipo): "Hoje para você" com
/// "Iniciar treino" (BK-16), semana contra a meta do perfil, seus treinos
/// com "Iniciar", "+ Montar meu treino" e o resumo da evolução.
export function IndividualHome({ name, greeting, dateLabel, home, todayIso, trialNotice = null }: IndividualHomeProps) {
  const firstName = name.trim().split(/\s+/)[0] ?? name;
  const planned = [...new Set(home.workouts.flatMap((workout) => workout.days))];

  return (
    <AppShell eyebrow={dateLabel} title={`${greeting}, ${firstName}.`} headerMode="mobile" navItems={INDIVIDUAL_NAV_ITEMS} activeKey="hoje" trailing={<LogoutButton />}>
      {trialNotice ? (
        <Link href="/painel/assinatura" className={styles.trial}>
          <span>{trialNotice}</span>
          <span aria-hidden="true">→</span>
        </Link>
      ) : null}
      {home.inProgress ? (
        <section className={`${styles.hero} ${styles.heroLive}`} aria-label="Treino em andamento">
          <p className={styles.eyebrow}>Em andamento</p>
          <h2 className={styles.heroTitle}>{home.inProgress.workoutName}</h2>
          <ProgressBar value={home.inProgress.total ? (100 * home.inProgress.done) / home.inProgress.total : 0} label="Progresso do treino" valueText={`${home.inProgress.done} de ${home.inProgress.total} exercícios`} />
          <p className={styles.heroMeta}>
            {home.inProgress.done} de {home.inProgress.total} exercícios · começou há {home.inProgress.minutesAgo < 1 ? "menos de 1 min" : `${home.inProgress.minutesAgo} min`}
          </p>
          <Button href={SESSION_HREF} size="xl" block>
            Continuar treino
          </Button>
        </section>
      ) : home.today ? (
        <section className={styles.hero} aria-label="Hoje para você">
          <p className={styles.eyebrow}>{home.today.reason === "dia" ? "Hoje para você" : "Sugestão de hoje"}</p>
          <h2 className={styles.heroTitle}>{home.today.name}</h2>
          <p className={styles.heroMeta}>
            {home.today.exercises} {home.today.exercises === 1 ? "exercício" : "exercícios"} · cerca de {home.today.estimatedMinutes} min
            {home.today.reason === "rodizio" ? " · o que você fez há mais tempo" : ""}
          </p>
          <Button href={`${SESSION_HREF}?treino=${home.today.id}`} size="xl" block>
            Iniciar treino
          </Button>
        </section>
      ) : (
        <NextStepCard eyebrow="Primeiro passo" title="Criar meu primeiro treino" description="Escolha os exercícios na biblioteca. Entram com 3 × 12." href="/painel/meus-treinos/novo" />
      )}

      {home.progressions.length > 0 && !home.inProgress ? <ProgressionCard suggestions={home.progressions} /> : null}

      <section className={styles.section} aria-labelledby="semana">
        <div className={styles.sectionHead}>
          <h2 id="semana" className={styles.sectionTitle}>
            Sua semana
          </h2>
          <span className={styles.muted}>
            {home.week.doneCount} de {home.week.target} treinos
          </span>
        </div>
        <WeekStrip days={weekStripFromDays(planned, { done: home.week.done, today: new Date(todayIso) })} label="Sua semana" />
      </section>

      <section className={styles.section} aria-labelledby="seus-treinos">
        <div className={styles.sectionHead}>
          <h2 id="seus-treinos" className={styles.sectionTitle}>
            Seus treinos
          </h2>
          <Link href="/painel/meus-treinos" className={styles.link}>
            Ver todos
          </Link>
        </div>
        {home.workouts.length > 0 ? (
          <ul className={styles.list}>
            {home.workouts.slice(0, 4).map((workout) => (
              <li key={workout.id}>
                <ActionRow
                  title={workout.name}
                  description={`${workout.exercises} ${workout.exercises === 1 ? "exercício" : "exercícios"} · ${formatDays(workout.days)}`}
                  trailing={
                    workout.exercises > 0 ? (
                      <Button href={`${SESSION_HREF}?treino=${workout.id}`} variant="quiet" aria-label={`Iniciar ${workout.name}`}>
                        Iniciar
                      </Button>
                    ) : (
                      <Button href={`/painel/meus-treinos/${workout.id}`} variant="quiet" aria-label={`Montar ${workout.name}`}>
                        Montar
                      </Button>
                    )
                  }
                />
              </li>
            ))}
          </ul>
        ) : null}
        <Link href="/painel/meus-treinos/novo" className={styles.add}>
          + Montar meu treino
        </Link>
      </section>

      <section className={styles.section} aria-labelledby="evolucao">
        <h2 id="evolucao" className={styles.sectionTitle}>
          Sua evolução
        </h2>
        <ul className={styles.stats}>
          <li>
            <Link href="/painel/minha-evolucao" className={styles.stat}>
              <span className={styles.statValue}>{home.monthSessions}</span>{" "}
              <span className={styles.muted}>treinos no mês</span>
            </Link>
          </li>
          <li>
            <Link href="/painel/minha-evolucao?aba=metas" className={styles.stat}>
              <span className={styles.statValue}>{home.activeGoals}</span>{" "}
              <span className={styles.muted}>{home.activeGoals === 1 ? "meta em andamento" : "metas em andamento"}</span>
            </Link>
          </li>
        </ul>
      </section>
    </AppShell>
  );
}
