import type { ReactNode } from "react";
import Link from "next/link";
import styles from "./NextStepCard.module.css";

interface NextStepCardProps {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  href?: string;
  onClick?: () => void;
  /// "plus" para criar algo novo; "arrow" para seguir para outro lugar.
  icon?: "plus" | "arrow";
}

function Icon({ name }: { name: "plus" | "arrow" }) {
  return (
    <span className={styles.icon} aria-hidden="true">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        {name === "plus" ? <path d="M12 5v14M5 12h14" /> : <path d="M5 12h14M13 6l6 6-6 6" />}
      </svg>
    </span>
  );
}

/// "Próximo passo" (FIT-171): o cartão escuro com borda laranja que abre
/// as telas de gestão com a ação principal. O cartão inteiro é o alvo.
export function NextStepCard({ eyebrow, title, description, href, onClick, icon = "plus" }: NextStepCardProps) {
  const content = (
    <>
      <span className={styles.text}>
        <span className={styles.eyebrow}>{eyebrow}</span>
        <span className={styles.title}>{title}</span>
        {description ? <span className={styles.description}>{description}</span> : null}
      </span>
      <Icon name={icon} />
    </>
  );
  if (href) {
    return (
      <Link href={href} className={styles.card}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" className={styles.card} onClick={onClick}>
      {content}
    </button>
  );
}
