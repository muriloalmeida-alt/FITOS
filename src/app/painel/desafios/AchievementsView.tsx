import Link from "next/link";
import { ProgressBar } from "@/shared/ui";
import { formatPoints } from "@/shared/lib/scoring";
import { MEDALS, type Medal } from "@/shared/lib/medals";
import type { Achievements, PeriodSummary } from "@/modules/gamification/achievements";
import styles from "./AchievementsView.module.css";

const INITIALS: Record<Medal, string> = { BRONZE: "B", PRATA: "P", OURO: "O", PLATINA: "Pt" };
const MEDAL_STYLE: Record<Medal, string> = { BRONZE: styles.bronze!, PRATA: styles.prata!, OURO: styles.ouro!, PLATINA: styles.platina! };
const dayFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
const monthFmt = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });

function medalInfo(medal: Medal) {
  return MEDALS.find((band) => band.medal === medal)!;
}

function periodLabel(period: PeriodSummary): string {
  if (period.type === "MES") return monthFmt.format(new Date(period.startsAt.getTime() + 12 * 3_600_000));
  return `${dayFmt.format(period.startsAt)} a ${dayFmt.format(new Date(period.endsAt.getTime() - 1))}`;
}

function MedalBadge({ medal, size = "md" }: { medal: Medal | null; size?: "md" | "lg" }) {
  const info = medal ? medalInfo(medal) : null;
  return (
    <span className={`${styles.badge} ${size === "lg" ? styles.badgeLg : ""} ${medal ? MEDAL_STYLE[medal] : styles.none}`} role="img" aria-label={info ? `Medalha ${info.label}` : "Sem medalha ainda"}>
      {medal ? INITIALS[medal] : "–"}
    </span>
  );
}

function Current({ period, title }: { period: PeriodSummary; title: string }) {
  const percent = period.goalTenths > 0 ? Math.min(100, (100 * period.pointsTenths) / period.goalTenths) : 0;
  const info = period.medal ? medalInfo(period.medal) : null;
  return (
    <section className={styles.current} aria-label={title}>
      <div className={styles.head}>
        <MedalBadge medal={period.medal} size="lg" />
        <div>
          <p className={styles.eyebrow}>
            {title} · {periodLabel(period)}
          </p>
          <h2 className={styles.medalTitle}>{info ? `${info.label} · ${info.title}` : "Rumo ao Bronze"}</h2>
        </div>
      </div>
      <ProgressBar value={percent} label={`Pontos d${title === "Semana" ? "a semana" : "o mês"}`} valueText={`${formatPoints(period.pointsTenths)} de ${formatPoints(period.goalTenths)} pontos`} />
      <p className={styles.line}>
        <strong>
          {formatPoints(period.pointsTenths)}/{formatPoints(period.goalTenths)} pontos
        </strong>
        {period.next ? ` · faltam ${formatPoints(period.next.missingTenths)} para ${period.next.label}` : " · faixa máxima"}
      </p>
      <p className={styles.muted}>
        Meta: {period.plannedDays} {period.plannedDays === 1 ? "treino" : "treinos"} × {period.itemsPerWorkout} exercícios × 10 pontos.
      </p>
    </section>
  );
}

/// Conquistas (Desafios): medalha da semana e do mês contra a meta
/// congelada, faixas, galeria dos períodos encerrados e o que falta.
export function AchievementsView({ achievements }: { achievements: Achievements }) {
  const { week, month, weeks, months, pendingPhotos } = achievements;
  return (
    <div className={styles.view}>
      {pendingPhotos > 0 ? (
        <p className={styles.notice} role="status">
          {pendingPhotos === 1 ? "1 treino desta semana espera foto" : `${pendingPhotos} treinos desta semana esperam foto`} para os pontos contarem. Adicione no resumo do treino.
        </p>
      ) : null}
      <Current period={week} title="Semana" />
      <Current period={month} title="Mês" />

      <h2 className={styles.cap}>Faixas</h2>
      <ul className={styles.bands}>
        {MEDALS.map((band) => (
          <li key={band.medal}>
            <MedalBadge medal={band.medal} />
            <span>
              <strong>
                {band.label} · {band.title}
              </strong>
              <span className={styles.muted}>{band.percent}% da meta</span>
            </span>
          </li>
        ))}
      </ul>

      <h2 className={styles.cap}>Galeria</h2>
      {weeks.length + months.length === 0 ? (
        <p className={styles.muted}>
          As semanas e os meses encerrados aparecem aqui com a medalha conquistada. <Link href="/painel">Comece um treino</Link>.
        </p>
      ) : (
        <ul className={styles.gallery}>
          {[...months, ...weeks].map((period) => (
            <li key={`${period.type}-${period.key}`}>
              <MedalBadge medal={period.medal} />
              <span>
                <strong>{period.type === "MES" ? `Mês de ${periodLabel(period)}` : `Semana ${periodLabel(period)}`}</strong>
                <span className={styles.muted}>
                  {formatPoints(period.pointsTenths)}/{formatPoints(period.goalTenths)} pontos{period.medal ? ` · ${medalInfo(period.medal).label}` : ""}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className={styles.muted}>Pontos contam depois da foto do treino. Medalhas não dão pontos extras.</p>
    </div>
  );
}
