"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/shared/ui";
import styles from "./LandingHeader.module.css";

interface LandingHeaderProps {
  appName: string;
}

/// Cabeçalho da landing comercial (FIT-110). Sticky, sempre sobre o
/// "chrome" escuro (mesmos tokens `--fitos-color-chrome*` já usados pelo
/// `AppShell` autenticado) — nunca alterna com o tema claro/escuro do
/// sistema, exatamente como a seção 4.2 do pacote pede ("fundo
/// predominantemente preto, grafite e cinza profundo"). O menu mobile é o
/// único estado interativo desta página que precisa de client component;
/// todo o resto da landing é Server Component.
export function LandingHeader({ appName }: LandingHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className={styles.header}>
      <div className={styles.bar}>
        <Link href="/" className={styles.brand}>
          {appName}
        </Link>

        <nav className={styles.desktopNav} aria-label="Navegação principal">
          <Link href="#recursos" className={styles.navLink}>
            Recursos
          </Link>
          <Link href="#para-quem" className={styles.navLink}>
            Para quem
          </Link>
          <Link href="#comecar" className={styles.navLink}>
            Começar
          </Link>
        </nav>

        <div className={styles.desktopActions}>
          <Link href="/entrar" className={styles.enterLink}>
            Entrar
          </Link>
          <Button href="/criar-conta" variant="filled" className={styles.ctaButton}>
            Criar conta grátis
          </Button>
        </div>

        <button
          type="button"
          className={styles.menuToggle}
          aria-expanded={isMenuOpen}
          aria-controls="landing-mobile-nav"
          aria-label={isMenuOpen ? "Fechar menu" : "Abrir menu"}
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          {isMenuOpen ? "✕" : "☰"}
        </button>
      </div>

      {isMenuOpen ? (
        <nav id="landing-mobile-nav" className={styles.mobileNav} aria-label="Navegação principal (mobile)">
          <Link href="#recursos" className={styles.mobileNavLink} onClick={() => setIsMenuOpen(false)}>
            Recursos
          </Link>
          <Link href="#para-quem" className={styles.mobileNavLink} onClick={() => setIsMenuOpen(false)}>
            Para quem
          </Link>
          <Link href="#comecar" className={styles.mobileNavLink} onClick={() => setIsMenuOpen(false)}>
            Começar
          </Link>
          <Link href="/entrar" className={styles.mobileNavLink} onClick={() => setIsMenuOpen(false)}>
            Entrar
          </Link>
          <Button href="/criar-conta" variant="filled" className={styles.mobileCta}>
            Criar conta grátis
          </Button>
        </nav>
      ) : null}
    </header>
  );
}
