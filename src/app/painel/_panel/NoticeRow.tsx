import Link from "next/link";
import styles from "./NoticeRow.module.css";

/// Aviso do Início numa linha (pagamento, aula, ficha, peso, risco…): o
/// Início mostra um de cada vez e cabe na tela sem rolagem.
export function NoticeRow({ eyebrow, text, href, tone = "default" }: { eyebrow?: string; text: string; href: string; tone?: "default" | "warn" }) {
  return (
    <Link href={href} className={tone === "warn" ? `${styles.row} ${styles.warn}` : styles.row}>
      <span className={styles.text}>
        {eyebrow ? <span className={styles.eyebrow}>{eyebrow}</span> : null}
        <span className={styles.main}>{text}</span>
      </span>
      <span className={styles.arrow} aria-hidden="true">
        →
      </span>
    </Link>
  );
}
