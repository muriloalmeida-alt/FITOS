"use client";

import { useState } from "react";
import Image from "next/image";
import { PulseLine } from "@/shared/ui";
import styles from "./PersonalHero.module.css";

/**
 * Faixa editorial do Início do Personal (Lote B, FIT-082; foto atualizada
 * na FIT-133/pacote visual 2026 para `scene-program.png` — "Personal
 * preparando programa no tablet", exatamente o uso que a tabela de assets
 * do pacote define para o dashboard do Personal). Mesma filosofia de
 * fallback do `AuthHero`: se a imagem de marca falhar, o gradiente
 * `--fitos-color-chrome*` + `PulseLine` permanecem como o próprio conteúdo,
 * nunca um estado de erro.
 */
export function PersonalHero() {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div className={styles.hero}>
      {!imageFailed ? (
        <Image
          src="/media/brand/visual-2026/scene-program.png"
          alt=""
          fill
          priority
          sizes="100vw"
          style={{ objectPosition: "62% 30%" }}
          className={styles.image}
          onError={() => setImageFailed(true)}
        />
      ) : null}
      <div className={styles.overlay} />
      <div className={styles.content}>
        <PulseLine variant="brand" className={styles.pulse} />
        <p className={styles.headline}>Sua equipe está em movimento.</p>
      </div>
    </div>
  );
}
