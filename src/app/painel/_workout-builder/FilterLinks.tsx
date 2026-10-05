import Link from "next/link";
import styles from "./FilterLinks.module.css";

/// Filtros que são rotas (ex.: Ativos · 3 / Arquivados · 1): links em
/// pílula com `aria-current` no ativo.
export function FilterLinks({ label, items }: { label: string; items: { label: string; href: string; active: boolean }[] }) {
  return (
    <nav className={styles.filters} aria-label={label}>
      {items.map((item) => (
        <Link key={item.href} href={item.href} className={item.active ? `${styles.chip} ${styles.active}` : styles.chip} aria-current={item.active ? "page" : undefined}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
