"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/shared/ui";
import styles from "./SplashScreen.module.css";

/// Tempo mínimo da abertura: o bastante para a animação de entrada
/// terminar sem parecer um "piscar", curto o bastante para não atrasar o
/// acesso. Com movimento reduzido, só um instante. A saída (fade) soma
/// `EXIT_MS` antes da troca de rota.
export const SPLASH_MIN_MS = 1400;
export const SPLASH_REDUCED_MOTION_MIN_MS = 300;
export const SPLASH_EXIT_MS = 240;

interface SplashScreenProps {
  /// Destino já decidido no servidor pela sessão real (`/painel` ou
  /// `/entrar`) — nenhuma decisão de autenticação acontece aqui.
  destination: string;
}

/**
 * Tela de abertura (FIT-141): marca, tagline e carregamento com movimento
 * sobre as ondas de luz laranja. Enquanto anima, pré-carrega o destino e,
 * ao fim, troca com `replace` (a abertura não fica no histórico — "voltar"
 * não retorna a ela).
 */
export function SplashScreen({ destination }: SplashScreenProps) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    router.prefetch(destination);

    const reducedMotion =
      typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const minMs = reducedMotion ? SPLASH_REDUCED_MOTION_MIN_MS : SPLASH_MIN_MS;

    let exitTimer: ReturnType<typeof setTimeout> | undefined;
    const minTimer = setTimeout(() => {
      setLeaving(true);
      exitTimer = setTimeout(() => router.replace(destination), SPLASH_EXIT_MS);
    }, minMs);

    return () => {
      clearTimeout(minTimer);
      if (exitTimer) clearTimeout(exitTimer);
    };
  }, [destination, router]);

  return (
    <main className={[styles.splash, leaving ? styles.leaving : null].filter(Boolean).join(" ")} aria-busy="true">
      <div className={styles.glowLeft} aria-hidden />
      <div className={styles.glowTop} aria-hidden />

      <svg className={styles.waves} viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <linearGradient id="splash-wave" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#ff7847" stopOpacity="0" />
            <stop offset="0.25" stopColor="#ff7847" stopOpacity="0.55" />
            <stop offset="0.7" stopColor="#ff9a6e" stopOpacity="0.95" />
            <stop offset="1" stopColor="#ff7847" stopOpacity="0.35" />
          </linearGradient>
          <linearGradient id="splash-band" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#cc3600" stopOpacity="0.35" />
            <stop offset="1" stopColor="#07090d" stopOpacity="0" />
          </linearGradient>
          <filter id="splash-haze" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
          <filter id="splash-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g className={styles.drift}>
          <path className={styles.band} d="M-40 772 C 110 716 262 646 430 412 L 430 844 L -40 844 Z" fill="url(#splash-band)" />
          {/* Faixa de luz difusa sob as curvas (a "massa" luminosa da referência). */}
          <path className={styles.haze} d="M-40 786 C 120 726 272 652 430 440" />
          <path className={`${styles.haze} ${styles.hazeTop}`} d="M430 110 C 384 214 326 294 244 360" />

          <path className={`${styles.line} ${styles.lineMain}`} d="M-40 772 C 110 716 262 646 430 412" pathLength={1} />
          <path className={`${styles.line} ${styles.lineSoft}`} d="M-40 800 C 130 736 286 664 430 470" pathLength={1} />
          <path className={`${styles.line} ${styles.lineFaint}`} d="M-40 738 C 96 704 250 628 430 368" pathLength={1} />
          <path className={`${styles.line} ${styles.lineTop}`} d="M430 96 C 388 196 330 282 250 352" pathLength={1} />

          {/* Brilho que percorre as curvas continuamente. */}
          <path className={`${styles.spark} ${styles.sparkMain}`} d="M-40 772 C 110 716 262 646 430 412" pathLength={1} />
          <path className={`${styles.spark} ${styles.sparkSoft}`} d="M-40 800 C 130 736 286 664 430 470" pathLength={1} />
        </g>
      </svg>

      <div className={styles.center}>
        <BrandLogo background="photo" size={86} className={styles.logo} />
        <p className={styles.tagline}>Treino leva mais longe</p>

        <div className={styles.loader} role="status">
          <span className={styles.ring} aria-hidden />
          <span className={styles.label}>
            Carregando
            <span className={styles.dots} aria-hidden>
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </span>
          </span>
        </div>
      </div>

      <noscript>
        <a className={styles.noscript} href={destination}>
          Continuar
        </a>
      </noscript>
    </main>
  );
}
