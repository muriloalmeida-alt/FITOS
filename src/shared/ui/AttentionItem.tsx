import type { ReactNode } from "react";
import Link from "next/link";
import styles from "./AttentionItem.module.css";

interface AttentionItemProps {
  /** Símbolo curto (1-2 caracteres) — nunca uma foto, sempre `aria-hidden`. */
  icon: ReactNode;
  title: string;
  description: string;
  tone?: "neutral" | "warning";
  href?: string;
  onClick?: () => void;
}

/// Item da lista "precisa de atenção" (docs/03-experience/UX-ARCHITECTURE.md
/// — convite expirando, avaliação vencida, cobrança atrasada, evolução a
/// celebrar). Nunca depende só da cor para comunicar o tom: `tone="warning"`
/// também muda o rótulo visualmente reservado à borda/ícone, mas o texto de
/// `title`/`description` já carrega o significado (ex.: "Avaliação há 62
/// dias") — a cor é reforço, nunca a única informação.
export function AttentionItem({ icon, title, description, tone = "neutral", href, onClick }: AttentionItemProps) {
  const toneClass = tone === "warning" ? styles.warning : styles.neutral;
  const content = (
    <>
      <span className={styles.icon} aria-hidden="true">
        {icon}
      </span>
      <span className={styles.text}>
        <strong className={styles.title}>{title}</strong>
        <span className={styles.description}>{description}</span>
      </span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={`${styles.item} ${toneClass} ${styles.asButton}`}>
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${styles.item} ${toneClass} ${styles.asButton}`}>
        {content}
      </button>
    );
  }

  return <div className={`${styles.item} ${toneClass}`}>{content}</div>;
}
