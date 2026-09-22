"use client";

import { useState } from "react";
import Image from "next/image";
import styles from "./ExerciseThumbnail.module.css";

interface ExerciseThumbnailProps {
  src: string | null;
  alt: string;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
}

/// Ilustração de exercício (FIT-111) com estado de "imagem indisponível"
/// (`onError`, cliente): tanto um exercício sem `imageUrl` (catálogo
/// próprio do personal, ou ilustração ainda não importada) quanto uma falha
/// real de carregamento caem no mesmo placeholder — nunca uma quebra visual
/// de imagem (ícone padrão do navegador).
export function ExerciseThumbnail({ src, alt, width, height, className, priority }: ExerciseThumbnailProps) {
  const [failed, setFailed] = useState(false);
  const classes = [styles.thumbnail, className].filter(Boolean).join(" ");

  if (!src || failed) {
    return (
      <span className={classes} style={{ width, height }} role="img" aria-label={alt}>
        <span className={styles.placeholderText}>Sem imagem</span>
      </span>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={classes}
      onError={() => setFailed(true)}
      loading={priority ? undefined : "lazy"}
      priority={priority}
    />
  );
}
