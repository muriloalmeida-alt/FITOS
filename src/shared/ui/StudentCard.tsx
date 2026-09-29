import Link from "next/link";
import { Avatar } from "./Avatar";
import { WeeklyRhythmBar } from "./WeeklyRhythm";
import styles from "./StudentCard.module.css";

export type StudentCardStatusTone = "positive" | "warning" | "neutral";

interface StudentCardProps {
  name: string;
  statusLabel: string;
  statusTone: StudentCardStatusTone;
  description?: string;
  href?: string;
  /// Ritmo semanal real (FIT-137, `getWeeklyRhythmForStudent`) — barra
  /// "X de Y dias" (tela-07). Opcional: alunos sem plano ativo (inativos,
  /// vínculo encerrado, ainda sem atribuição) não têm meta semanal real
  /// para comparar, então a barra simplesmente não aparece.
  weeklyRhythm?: { completedDays: number; targetDays: number };
}

/// Cartão de aluno com identidade (docs/01-DIRECAO-VISUAL.md — "alunos são
/// pessoas acompanhadas, não linhas de tabela"). Substitui a linha de texto
/// simples usada hoje em `/painel/alunos`. Reaproveita `Avatar` (iniciais,
/// nunca foto — docs/06-GOVERNANCA-DE-MIDIA.md). `statusLabel` é sempre
/// texto (ex.: "Ativa", "Atenção"), nunca só a cor de `statusTone`.
/// FIT-137 (correção pós-validação real, pacote visual 2026 — tela-07):
/// ganha a barra de ritmo semanal real e o rótulo visível "Abrir perfil →"
/// (antes o cartão era clicável sem nenhuma affordance de texto).
export function StudentCard({ name, statusLabel, statusTone, description, href, weeklyRhythm }: StudentCardProps) {
  const content = (
    <>
      <div className={styles.topRow}>
        <Avatar name={name} />
        <span className={styles.text}>
          <strong className={styles.name}>{name}</strong>
          {description ? <span className={styles.description}>{description}</span> : null}
        </span>
        <span className={`${styles.statusPill} ${styles[statusTone]}`}>{statusLabel}</span>
      </div>
      {weeklyRhythm ? (
        <WeeklyRhythmBar
          completedDays={weeklyRhythm.completedDays}
          targetDays={weeklyRhythm.targetDays}
          label={`${name}: ${weeklyRhythm.completedDays} de ${weeklyRhythm.targetDays} dias treinados nesta semana`}
        />
      ) : null}
      {href ? <span className={styles.openProfile}>Abrir perfil →</span> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={styles.card}>
        {content}
      </Link>
    );
  }

  return <div className={styles.card}>{content}</div>;
}
