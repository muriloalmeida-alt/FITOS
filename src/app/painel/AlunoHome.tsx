import Link from "next/link";
import { ActionRow, AppShell, Button, NextStepCard, ProgressBar, WeekStrip } from "@/shared/ui";
import { formatCentsBRL } from "@/shared/lib/money";
import type { StudentHome } from "@/modules/students/studentHome";
import { weekStripFromDays } from "@/shared/lib/weekdays";
import { LogoutButton } from "./LogoutButton";
import { ALUNO_NAV_ITEMS } from "./navigation";
import { WeighPrompt } from "./WeighPrompt";
import styles from "./AlunoHome.module.css";

interface AlunoHomeProps {
  displayName: string;
  personalName: string;
  /// Saudação e data do servidor, no fuso do produto.
  greeting: string;
  dateLabel?: string;
  home: StudentHome;
  /// Data de "hoje" (ISO) para destacar o dia na faixa da semana.
  todayIso: string;
  /// Mensalidade em aberto com link de pagamento (EPIC-38).
  payment?: { description: string; amountCents: number; dueIso: string; overdue: boolean; url: string } | null;
  /// Ficha de saúde ainda não respondida (EPIC-46).
  healthPending?: boolean;
}

const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", timeZone: "America/Sao_Paulo" });

function Hero({ home, personalName }: { home: StudentHome; personalName: string }) {
  const { hero } = home;
  if (hero.kind === "progress") {
    const percent = hero.total > 0 ? (100 * hero.done) / hero.total : 0;
    return (
      <section className={`${styles.hero} ${styles.heroLive}`} aria-label="Treino em andamento">
        <p className={styles.eyebrow}>Em andamento</p>
        <h2 className={styles.heroTitle}>{hero.workoutName}</h2>
        <ProgressBar value={percent} label="Progresso do treino" valueText={`${hero.done} de ${hero.total} exercícios`} />
        <p className={styles.heroMeta}>
          {hero.done} de {hero.total} exercícios · começou há {hero.minutesAgo < 1 ? "menos de 1 min" : `${hero.minutesAgo} min`}
        </p>
        <Button href="/painel/treino/sessao" size="xl" block>
          Continuar treino
        </Button>
      </section>
    );
  }
  if (hero.kind === "today") {
    return (
      <section className={styles.hero} aria-label="Treino de hoje">
        <p className={styles.eyebrow}>Treino de hoje</p>
        <h2 className={styles.heroTitle}>{hero.workoutName}</h2>
        <p className={styles.heroMeta}>
          {hero.exercises} {hero.exercises === 1 ? "exercício" : "exercícios"} · cerca de {hero.estimatedMinutes} min
        </p>
        <Button href="/painel/treino/sessao" size="xl" block>
          Começar treino
        </Button>
      </section>
    );
  }
  if (hero.kind === "rest") {
    return (
      <section className={styles.hero} aria-label="Hoje">
        <p className={styles.eyebrow}>Hoje é descanso</p>
        <h2 className={styles.heroTitle}>Recupere bem.</h2>
        <p className={styles.heroMeta}>{hero.next ? `Próximo: ${hero.next.workoutName} · ${hero.next.dayLabel.toLowerCase()}` : "Nenhum treino previsto nos próximos dias."}</p>
        <Button href="/painel/treino" variant="secondary" block>
          Ver meu programa
        </Button>
      </section>
    );
  }
  return (
    <section className={styles.hero} aria-label="Programa">
      <p className={styles.eyebrow}>{hero.endedPlanName ? "Programa encerrado" : "Sem programa"}</p>
      <h2 className={styles.heroTitle}>{hero.endedPlanName ? `${hero.endedPlanName} terminou.` : "Seu programa está a caminho."}</h2>
      <p className={styles.heroMeta}>{personalName} já foi avisado e vai montar o próximo. Ele aparece aqui assim que estiver pronto.</p>
    </section>
  );
}

/// Início do Aluno (FIT-151, A1 do protótipo): o que fazer hoje com um
/// toque (começar, continuar, descanso ou programa a caminho), ritmo da
/// semana, próximos treinos e a última avaliação.
export function AlunoHome({ displayName, personalName, greeting, dateLabel, home, todayIso, payment = null, healthPending = false }: AlunoHomeProps) {
  const firstName = displayName.trim().split(/\s+/)[0] ?? displayName;
  const today = new Date(todayIso);
  const assessment = home.lastAssessment;
  const lastWeighDays = assessment ? Math.floor((today.getTime() - new Date(assessment.dateIso).getTime()) / 86_400_000) : null;
  const weighDue = lastWeighDays === null || lastWeighDays >= 14;
  const assessmentParts = assessment
    ? [assessment.weightKg !== null ? `${assessment.weightKg.toLocaleString("pt-BR")} kg` : null, assessment.bodyFatPercent !== null ? `${assessment.bodyFatPercent.toLocaleString("pt-BR")}% gordura` : null].filter(Boolean)
    : [];

  return (
    <AppShell eyebrow={dateLabel} title={`${greeting}, ${firstName}.`} headerMode="mobile" navItems={ALUNO_NAV_ITEMS} activeKey="hoje" trailing={<LogoutButton />}>
      <Hero home={home} personalName={personalName} />

      {payment ? (
        <NextStepCard
          eyebrow={payment.overdue ? "Mensalidade atrasada" : "Mensalidade"}
          title={`Pagar ${formatCentsBRL(payment.amountCents)}`}
          description={`${payment.description} · ${payment.overdue ? "venceu" : "vence"} em ${dateFmt.format(new Date(payment.dueIso))}. Pix, boleto ou cartão, direto para ${personalName.split(/\s+/)[0]}.`}
          href={payment.url}
        />
      ) : null}

      {healthPending ? (
        <NextStepCard eyebrow="2 minutos" title="Responda sua ficha de saúde" description={`Para ${personalName.split(/\s+/)[0]} montar seu treino com segurança.`} href="/painel/saude" />
      ) : null}

      {home.program ? (
        <section className={styles.section} aria-labelledby="sua-semana">
          <div className={styles.sectionHead}>
            <h2 id="sua-semana" className={styles.sectionTitle}>
              Sua semana
            </h2>
            <span className={styles.sectionMeta}>{home.week.target ? `${home.week.doneCount} de ${home.week.target} treinos` : `${home.week.doneCount} treinos`}</span>
          </div>
          <WeekStrip days={weekStripFromDays(home.week.planned, { done: home.week.done, today })} label="Sua semana" />
          <p className={styles.program}>
            {home.program.name}
            {home.program.week && home.program.weeks ? ` · semana ${home.program.week} de ${home.program.weeks}` : ""}
          </p>
        </section>
      ) : null}

      {weighDue ? <WeighPrompt lastLabel={assessment ? dateFmt.format(new Date(assessment.dateIso)) : null} todayKey={todayIso.slice(0, 10)} /> : null}

      <ActionRow
        href="/painel/meta"
        title={home.goal ?? "Escolher uma meta"}
        description={home.goal ? "Sua meta · trocar" : "Três sugestões feitas para você"}
        trailing={<span aria-hidden="true">›</span>}
      />

      {home.upcoming.length > 0 ? (
        <section className={styles.section} aria-labelledby="proximos">
          <h2 id="proximos" className={styles.sectionTitle}>
            Próximos treinos
          </h2>
          <ul className={styles.list}>
            {home.upcoming.map((item) => (
              <li key={item.dayLabel}>
                <ActionRow href="/painel/treino" leading={<span className={styles.day}>{item.dayShort}</span>} title={item.workoutName} description={item.dayLabel} trailing={<span aria-hidden="true">›</span>} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={styles.section} aria-labelledby="avaliacao">
        <h2 id="avaliacao" className={styles.sectionTitle}>
          Último peso
        </h2>
        <ActionRow
          href="/painel/progresso"
          title={assessment ? (assessmentParts.length > 0 ? assessmentParts.join(" · ") : "Avaliação registrada") : "Nenhuma avaliação ainda"}
          description={assessment ? `${dateFmt.format(new Date(assessment.dateIso))} · ver sua evolução` : "Pese-se e acompanhe aqui."}
          trailing={<span aria-hidden="true">›</span>}
        />
      </section>

      <p className={styles.footnote}>
        Treinando com {personalName}. <Link href="/painel/perfil">Seu perfil</Link>
      </p>
    </AppShell>
  );
}
