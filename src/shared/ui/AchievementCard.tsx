import type { ReactNode } from "react";
import styles from "./AchievementCard.module.css";

interface AchievementCardProps {
  icon: ReactNode;
  title: string;
  description: string;
}

/// Conquista/marco de evolução (docs/03-experience/UX-ARCHITECTURE.md —
/// "Evolução positiva a celebrar" no modelo de atenção do dashboard; tela
/// "Progresso" do aluno). Tom sempre celebratório, nunca neutro/genérico —
/// distinto de `AttentionItem` (que cobre também os tons de aviso), este é
/// exclusivamente para marcos positivos.
export function AchievementCard({ icon, title, description }: AchievementCardProps) {
  return (
    <div className={styles.card}>
      <span className={styles.icon} aria-hidden="true">
        {icon}
      </span>
      <div className={styles.text}>
        <strong className={styles.title}>{title}</strong>
        <span className={styles.description}>{description}</span>
      </div>
    </div>
  );
}
