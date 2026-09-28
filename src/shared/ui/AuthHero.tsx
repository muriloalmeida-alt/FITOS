"use client";

import { useState } from "react";
import Image from "next/image";
import { BrandLogo } from "./BrandLogo";
import styles from "./AuthHero.module.css";

interface AuthHeroImage {
  src: string;
  objectPosition?: string;
}

interface AuthHeroProps {
  eyebrow?: string;
  headline: string;
  /** Segunda linha do headline, em laranja (pacote visual 2026, FIT-131) — ex.: "Movimento começa" + `headlineAccent="com um plano."`. Sem ela, o headline inteiro fica em uma única cor/linha (comportamento anterior). Mutuamente exclusivo com `subtitle`. */
  headlineAccent?: string;
  /** Parágrafo neutro abaixo do headline (pacote visual 2026, tela 04 — "Vamos cuidar da rotina junto com você."), sem o destaque em laranja de `headlineAccent`. */
  subtitle?: string;
  /** Foto editorial de fundo. Sem ela, mantém o gradiente de marca anterior (fallback histórico do componente, ainda usado por `/treino-sozinho`). */
  image?: AuthHeroImage;
  /** Mostrar também no breakpoint compact (pacote visual 2026): os prints em 390px mostram a foto como banda superior, diferente do padrão anterior (só desktop, `min-width: 840px`). Default `false` preserva quem ainda não migrou. */
  showOnMobile?: boolean;
}

const DEFAULT_IMAGE: AuthHeroImage = { src: "/media/brand/fitos-login-hero.png" };

/**
 * Painel editorial das telas de entrada/onboarding (pacote visual 2026,
 * FIT-131). Generalizado a partir do painel exclusivo de `/entrar`: agora
 * aceita foto/posição por chamador (`/entrar`, `/onboarding-personal`,
 * `/onboarding`), a marca real sobre foto (`BrandLogo background="photo"`,
 * nunca `background="dark"` sobre foto — cria a tarja que essa variante
 * existe para evitar) e headline em duas cores. Some no breakpoint compact
 * por padrão (a imagem nunca compete com o formulário em telas pequenas)
 * — `showOnMobile` inverte isso para as telas do pacote que pedem a foto
 * também em 390px, como banda superior fixa.
 *
 * A marca (`BrandLogo`) é sempre o próprio conteúdo do painel, com ou sem
 * foto: se a imagem falhar ao carregar, o gradiente de marca em `.hero`
 * permanece como fundo e a marca continua legível sobre ele — nunca um
 * estado de erro, nunca some.
 */
export function AuthHero({ eyebrow, headline, headlineAccent, subtitle, image = DEFAULT_IMAGE, showOnMobile = false }: AuthHeroProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const heroClasses = [styles.hero, showOnMobile ? styles.heroCompactVisible : null].filter(Boolean).join(" ");

  return (
    <div className={heroClasses}>
      {!imageFailed ? (
        <Image
          src={image.src}
          alt=""
          fill
          priority
          sizes={showOnMobile ? "100vw" : "(min-width: 840px) 50vw, 0px"}
          style={image.objectPosition ? { objectPosition: image.objectPosition } : undefined}
          className={styles.image}
          onError={() => setImageFailed(true)}
        />
      ) : null}
      <div className={styles.overlay} />
      <div className={styles.content}>
        <BrandLogo variant="horizontal" background="photo" size={20} className={styles.logo} />
        {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
        <p className={styles.headline}>
          {headline}
          {headlineAccent ? (
            <>
              <br />
              <span className={styles.headlineAccent}>{headlineAccent}</span>
            </>
          ) : null}
        </p>
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
      </div>
    </div>
  );
}
