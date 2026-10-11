import type { ReactNode } from "react";
import Link from "next/link";
import styles from "./ActionRow.module.css";

interface ActionRowProps {
  title: ReactNode;
  description?: ReactNode;
  /// Avatar, miniatura ou ícone à esquerda.
  leading?: ReactNode;
  /// Ação à direita (ex.: botão "Recebi", link "Editar", chevron).
  trailing?: ReactNode;
  /// Ação abaixo do texto (ex.: "Atribuir programa →" no feed).
  action?: { label: string; href?: string; onClick?: () => void };
  /// Com `href`, a linha inteira vira um link (e `trailing` vira só visual).
  href?: string;
  /// Com `onClick`, a linha inteira vira um botão.
  onClick?: () => void;
}

/// Linha de lista que termina numa ação (FIT-171, princípio "cada linha de
/// lista termina numa ação"). Nunca aninha elementos interativos: com
/// `href`/`onClick` a linha inteira é o alvo e `action` não é usada.
export function ActionRow({ title, description, leading, trailing, action, href, onClick }: ActionRowProps) {
  const body = (
    <>
      {leading ? <span className={styles.leading}>{leading}</span> : null}
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        {description ? <span className={styles.description}>{description}</span> : null}
        {!href && !onClick && action ? (
          action.href ? (
            <Link href={action.href} className={styles.action}>
              {action.label} →
            </Link>
          ) : (
            <button type="button" className={styles.action} onClick={action.onClick}>
              {action.label} →
            </button>
          )
        ) : null}
      </span>
      {trailing ? <span className={styles.trailing}>{trailing}</span> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={`${styles.row} ${styles.interactive}`}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" className={`${styles.row} ${styles.interactive}`} onClick={onClick}>
        {body}
      </button>
    );
  }
  return <div className={styles.row}>{body}</div>;
}
