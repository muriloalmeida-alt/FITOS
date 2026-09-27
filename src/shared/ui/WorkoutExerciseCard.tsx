import type { ReactNode } from "react";
import { ExerciseThumbnail } from "./ExerciseThumbnail";
import styles from "./WorkoutExerciseCard.module.css";

interface WorkoutExerciseCardProps {
  name: string;
  meta: string;
  thumbnailSrc: string | null;
  thumbnailAlt: string;
  trailing?: ReactNode;
}

/// Item de exercício dentro de um treino (builder de modelo, lista de
/// sessão) — reaproveita `ExerciseThumbnail` (mesmo fallback "Sem imagem"
/// já usado no catálogo, nunca um segundo componente de imagem). `meta` é
/// sempre texto ("4 × 10 · 90s descanso"), nunca inferido de ícones soltos.
/// `trailing` é o slot para a ação de contexto (reordenar, remover, avançar
/// — decidida pelo chamador, não por este componente).
export function WorkoutExerciseCard({ name, meta, thumbnailSrc, thumbnailAlt, trailing }: WorkoutExerciseCardProps) {
  return (
    <div className={styles.item}>
      <ExerciseThumbnail src={thumbnailSrc} alt={thumbnailAlt} width={56} height={56} className={styles.thumbnail} />
      <div className={styles.text}>
        <strong className={styles.name}>{name}</strong>
        <span className={styles.meta}>{meta}</span>
      </div>
      {trailing ? <div className={styles.trailing}>{trailing}</div> : null}
    </div>
  );
}
