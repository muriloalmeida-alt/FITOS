import type { ReactNode } from "react";
import Link from "next/link";
import { BrandLogo } from "@/shared/ui";
import styles from "../legal.module.css";

const TABS = [
  { key: "termos", label: "Termos de uso", href: "/termos-de-uso" },
  { key: "privacidade", label: "Privacidade", href: "/politica-de-privacidade" },
] as const;

/// Termos e Privacidade (FIT-170, E9 do protótipo): as duas páginas
/// legais lado a lado em abas, com medida de leitura confortável. Cada
/// aba é a própria URL pública, então os links existentes continuam
/// valendo.
export function LegalShell({ active, children }: { active: (typeof TABS)[number]["key"]; children: ReactNode }) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.content}>
        <header className={styles.top}>
          <Link href="/" className={styles.backLink}>
            ← Voltar ao início
          </Link>
          <BrandLogo background="photo" size={32} />
        </header>
        <nav className={styles.tabs} aria-label="Documentos legais">
          {TABS.map((tab) => (
            <Link key={tab.key} href={tab.href} className={tab.key === active ? `${styles.tab} ${styles.tabOn}` : styles.tab} aria-current={tab.key === active ? "page" : undefined}>
              {tab.label}
            </Link>
          ))}
        </nav>
        <article className={styles.article}>{children}</article>
      </div>
    </div>
  );
}
