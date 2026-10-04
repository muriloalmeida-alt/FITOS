import type { ReactNode } from "react";
import Link from "next/link";
import { BrandLogo } from "@/shared/ui";
import styles from "./Entrada.module.css";

/// Moldura das telas de entrada (FIT-163 a FIT-167): fundo escuro liso,
/// marca no topo, uma coluna legível e o rodapé com Termos e Privacidade.
export function EntradaShell({ children, back }: { children: ReactNode; back?: { href: string; label: string } }) {
  return (
    <main className={styles.main}>
      <div className={styles.column}>
        <div className={styles.top}>
          {back ? (
            <Link href={back.href} className={styles.back}>
              ‹ {back.label}
            </Link>
          ) : (
            <Link href="/conheca" aria-label="Conheça o FitOS">
              <BrandLogo size={44} decorative />
            </Link>
          )}
        </div>
        {children}
        <footer className={styles.footer}>
          <Link href="/termos-de-uso">Termos de uso</Link>
          <span aria-hidden="true">·</span>
          <Link href="/politica-de-privacidade">Privacidade</Link>
        </footer>
      </div>
    </main>
  );
}
