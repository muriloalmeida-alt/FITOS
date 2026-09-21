"use client";

import { useState } from "react";
import Image from "next/image";
import { PulseLine } from "./PulseLine";
import styles from "./AuthHero.module.css";

interface AuthHeroProps {
  eyebrow: string;
  headline: string;
}

/**
 * Painel editorial das telas de autenticação (docs/01-DIRECAO-VISUAL.md e
 * docs/06-GOVERNANCA-DE-MIDIA.md do pacote de redesign: "Fallback — Hero:
 * gradiente e PulseLine code-native"). Some no breakpoint compact (a
 * imagem nunca compete com o formulário em telas pequenas) e também se a
 * imagem falhar ao carregar — nesse caso o gradiente de marca com
 * `PulseLine` permanece como o próprio conteúdo do painel, não um estado
 * de erro.
 */
export function AuthHero({ eyebrow, headline }: AuthHeroProps) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div className={styles.hero}>
      {!imageFailed ? (
        <Image
          src="/media/brand/fitos-login-hero.png"
          alt=""
          fill
          priority
          sizes="(min-width: 840px) 50vw, 0px"
          className={styles.image}
          onError={() => setImageFailed(true)}
        />
      ) : null}
      <div className={styles.overlay} />
      <div className={styles.content}>
        <PulseLine variant="brand" className={styles.pulse} />
        <p className={styles.eyebrow}>{eyebrow}</p>
        <p className={styles.headline}>{headline}</p>
      </div>
    </div>
  );
}
