import Image from "next/image";
import { Button } from "./Button";
import styles from "./WorkoutTodayCard.module.css";

interface WorkoutTodayCardAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface WorkoutTodayCardProps {
  eyebrow?: string;
  title: string;
  description: string;
  meta?: string;
  imageSrc?: string;
  imageAlt?: string;
  action: WorkoutTodayCardAction;
}

/// Card de destaque da tela "Hoje" (docs/03-experience/UX-ARCHITECTURE.md —
/// jornada principal do aluno começa em "Abrir Hoje / revisar treino").
/// Fundo escuro com foto opcional — "superfícies escuras para foco e
/// execução" (docs/01-DIRECAO-VISUAL.md). Uma ação dominante só (`action`),
/// nunca duas CTAs competindo.
export function WorkoutTodayCard({ eyebrow, title, description, meta, imageSrc, imageAlt, action }: WorkoutTodayCardProps) {
  return (
    <div className={styles.card}>
      {imageSrc ? (
        <div className={styles.imageWrapper}>
          <Image src={imageSrc} alt={imageAlt ?? ""} fill className={styles.image} />
        </div>
      ) : null}
      <div className={styles.body}>
        <div className={styles.header}>
          {eyebrow ? <span className={styles.eyebrow}>{eyebrow}</span> : null}
          {meta ? <span className={styles.meta}>{meta}</span> : null}
        </div>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.description}>{description}</p>
        {action.href ? (
          <Button href={action.href} variant="filled" className={styles.action}>
            {action.label}
          </Button>
        ) : (
          <Button type="button" variant="filled" onClick={action.onClick} className={styles.action}>
            {action.label}
          </Button>
        )}
      </div>
    </div>
  );
}
