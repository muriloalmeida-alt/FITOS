import type { ReactNode } from "react";
import styles from "./Tag.module.css";

export type TagTone = "ok" | "warn" | "error" | "muted" | "accent";

/// Etiqueta de status (FIT-171). Sempre com texto — nunca status só por cor.
export function Tag({ tone = "muted", children }: { tone?: TagTone; children: ReactNode }) {
  return <span className={`${styles.tag} ${styles[tone]}`}>{children}</span>;
}
