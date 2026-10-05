"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/shared/ui";
import styles from "./SplashScreen.module.css";

/// Tempo da abertura: curto, só para reconhecer a marca. Com movimento
/// reduzido, quase nada. A saída (fade) soma `SPLASH_EXIT_MS`.
export const SPLASH_MIN_MS = 1200;
export const SPLASH_REDUCED_MOTION_MIN_MS = 300;
export const SPLASH_EXIT_MS = 200;

/**
 * Abertura (FIT-162, E1 do protótipo): a marca sobre fundo escuro liso.
 * Some sozinha ou com um toque, respeita `prefers-reduced-motion` e troca
 * com `replace` (não fica no histórico). Quem já tem sessão nem passa por
 * aqui: `/` redireciona direto ao Início.
 */
export function SplashScreen({ destination }: { destination: string }) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const done = useRef(false);

  const leave = useCallback(() => {
    if (done.current) return;
    done.current = true;
    setLeaving(true);
    setTimeout(() => router.replace(destination), SPLASH_EXIT_MS);
  }, [destination, router]);

  useEffect(() => {
    router.prefetch(destination);
    const reducedMotion = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = setTimeout(leave, reducedMotion ? SPLASH_REDUCED_MOTION_MIN_MS : SPLASH_MIN_MS);
    return () => clearTimeout(timer);
  }, [destination, router, leave]);

  return (
    <main className={leaving ? `${styles.splash} ${styles.leaving}` : styles.splash} onClick={leave} aria-busy="true">
      <div className={styles.center}>
        <BrandLogo background="photo" size={86} className={styles.logo} />
        <p className={styles.tagline}>Treino leva mais longe</p>
      </div>
      <button type="button" className={styles.skip} onClick={leave}>
        Toque para continuar
      </button>
      <noscript>
        <a className={styles.noscript} href={destination}>
          Continuar
        </a>
      </noscript>
    </main>
  );
}
