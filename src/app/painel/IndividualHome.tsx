import Link from "next/link";
import type { IndividualHome as IndividualHomeData } from "@/modules/workouts/individualHome";
import { panelGoals, panelWeek } from "@/shared/lib/panel";
import { INDIVIDUAL_NAV_ITEMS } from "./navigation";
import { ProgressionCard } from "./ProgressionCard";
import { StudentPanel } from "./_panel/StudentPanel";
import styles from "./IndividualHome.module.css";

interface IndividualHomeProps {
  name: string;
  dateLabel?: string;
  home: IndividualHomeData;
  /// Agora (ISO), no fuso do produto para a semana e o mês.
  todayIso: string;
  /// Treinos concluídos (data de realização, ISO) na semana e no mês.
  performed?: string[];
  /// "Meus dias"; vazios, contam os dias dos treinos.
  preferredDays?: string[];
  /// Registro de treino passado (FEATURE_RETROATIVO).
  retroEnabled?: boolean;
  /// EPIC-33: aviso de fim do teste sem cartão.
  trialNotice?: string | null;
}

const SESSION_HREF = "/painel/meus-treinos/sessao";

/// Início do FitOS Livre no painel aprovado (proposta 9): semana, Iniciar
/// treino (programado, avulso ou realizado) e evolução contra a meta.
export function IndividualHome({ name, dateLabel, home, todayIso, performed = [], preferredDays = [], retroEnabled = false, trialNotice = null }: IndividualHomeProps) {
  const firstName = name.trim().split(/\s+/)[0] ?? name;
  const now = new Date(todayIso);
  const dates = performed.map((iso) => new Date(iso));
  const planned = [...new Set(home.workouts.flatMap((workout) => workout.days))];
  const week = panelWeek(now, dates, planned);
  const goals = panelGoals(now, dates, preferredDays.length > 0 ? preferredDays : planned, home.week.target);
  const todayLabel = home.inProgress ? `Hoje: ${home.inProgress.workoutName} em andamento` : home.today?.reason === "dia" ? `Hoje: ${home.today.name}` : "Hoje: dia livre";
  const programmed = home.today
    ? { href: `${SESSION_HREF}?treino=${home.today.id}`, description: `Seguir o programa: ${home.today.name}` }
    : { href: "/painel/meus-treinos/biblioteca", description: "Sem programa ainda: escolha um pronto" };

  return (
    <StudentPanel
      firstName={firstName}
      dateLabel={dateLabel}
      message={home.inProgress ? "Seu treino está em andamento." : "Seu próximo treino começa aqui."}
      week={{ ...week, todayLabel }}
      evolution={{ ...goals, href: "/painel/minha-evolucao" }}
      start={{ inProgressHref: home.inProgress ? SESSION_HREF : null, programmed, free: true, done: retroEnabled ? "/painel/treinos-realizados/registrar" : null }}
      navItems={INDIVIDUAL_NAV_ITEMS}
      notices={
        <>
          {trialNotice ? (
            <Link href="/painel/assinatura" className={styles.trial}>
              <span>{trialNotice}</span>
              <span aria-hidden="true">→</span>
            </Link>
          ) : null}
          {home.progressions.length > 0 && !home.inProgress ? <ProgressionCard suggestions={home.progressions} /> : null}
        </>
      }
    />
  );
}
