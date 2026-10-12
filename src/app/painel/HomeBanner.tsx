"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PersonalHomeBanner } from "./PersonalHome";
import styles from "./PersonalHome.module.css";

/// Quanto tempo o aviso informativo fica na tela depois da entrada.
export const BANNER_VISIBLE_MS = 5000;

/// Faixa da assinatura no Início do personal. Aviso só informativo
/// (gratuidade, teste com folga, plano em dia) some depois de alguns
/// segundos; o que pede ação (cartão, pagamento, plano) fica.
export function HomeBanner({ banner }: { banner: PersonalHomeBanner }) {
  const autoHide = banner.tone !== "warn";
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!autoHide) return;
    const timer = window.setTimeout(() => setVisible(false), BANNER_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [autoHide]);

  return (
    <Link href="/painel/assinatura" className={`${styles.banner} ${styles[`banner_${banner.tone}`]} ${visible ? "" : styles.bannerHidden}`} aria-hidden={visible ? undefined : true}>
      <span>{banner.text}</span>
      <span className={styles.bannerCta}>
        {banner.cta} <span aria-hidden="true">→</span>
      </span>
    </Link>
  );
}
