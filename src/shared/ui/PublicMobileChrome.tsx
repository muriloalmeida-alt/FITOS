"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BrandLogo } from "./BrandLogo";
import styles from "./PublicMobileChrome.module.css";

/// Destinos públicos reais (AjustesTelas, 29/09/2026 — "Menu" das telas
/// 01–06 e 34–35). Nenhum destino sem rota implementada.
const PUBLIC_LINKS = [
  { href: "/conheca", label: "Conheça o FitOS" },
  { href: "/comecar", label: "Como começar" },
  { href: "/treino-sozinho", label: "FitOS Livre" },
  { href: "/entrar", label: "Entrar" },
  { href: "/termos-de-uso", label: "Termos de Uso" },
  { href: "/politica-de-privacidade", label: "Política de Privacidade" },
];

/// Cabeçalho mobile das telas públicas e de onboarding (AjustesTelas,
/// prints 01–06/34–35): marca oficial clara/laranja à esquerda (variante
/// sem retângulo de fundo) e "Menu" à direita, abaixo da área segura
/// superior. Só existe no mobile (< 840px) — o desktop mantém a composição
/// do pacote visual 2026 de cada página.
export function PublicMobileHeader() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onPointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <header className={styles.header} ref={containerRef}>
      <Link href="/conheca" className={styles.brand} aria-label="FitOS — conheça o FitOS">
        <BrandLogo background="photo" size={44} decorative />
      </Link>
      <button
        type="button"
        className={styles.menuButton}
        aria-expanded={open}
        aria-controls="public-mobile-menu"
        onClick={() => setOpen((current) => !current)}
      >
        {open ? "Fechar" : "Menu"}
      </button>
      {open ? (
        <nav id="public-mobile-menu" className={styles.menu} aria-label="Menu público">
          {PUBLIC_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={styles.menuLink} onClick={() => setOpen(false)}>
              {link.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  );
}

/// Rodapé mobile das telas públicas (AjustesTelas): assinatura da marca,
/// discreta, depois do conteúdo — nunca fixo sobre o CTA.
export function PublicMobileFooter() {
  return (
    <footer className={styles.footer}>
      <span>FitOS</span>
      <span aria-hidden="true">•</span>
      <span>Mais movimento, menos trabalho.</span>
    </footer>
  );
}
