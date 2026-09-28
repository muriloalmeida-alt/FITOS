import Image from "next/image";
import styles from "./BrandLogo.module.css";

export type BrandLogoVariant = "horizontal" | "symbol";
export type BrandLogoBackground = "dark" | "light" | "photo";

interface BrandLogoProps {
  variant?: BrandLogoVariant;
  background?: BrandLogoBackground;
  /** Altura renderizada em px (`variant="horizontal"`) ou lado do ícone quadrado (`variant="symbol"`). */
  size?: number;
  /** Nome acessível quando não decorativo. Default `"FitOS"`. */
  title?: string;
  /** Marca a marca como puramente decorativa (`alt=""`) — usar quando o contexto ao redor (ex.: um link já nomeado) já identifica a marca. Default `false`. */
  decorative?: boolean;
  className?: string;
}

/// Marca gráfica oficial do FitOS (FIT-124/EPIC-16, ADR-012,
/// docs/03-design/MARCA-FITOS-OFICIAL.md) — vetores aprovados do pacote
/// `FitOS_Marca_Proposta_v1(1).zip`, preservados sem redesenho em
/// `public/marca/`. Cada arquivo já embute suas próprias cores (não depende
/// dos tokens CSS) e, na variante horizontal, já traz o wordmark "FitOS"
/// como contorno vetorial incorporado ao SVG — nenhum texto real em DOM
/// (diferente da proposta interna anterior deste componente, substituída
/// aqui). `background="dark"` usa a variante "escuro" (self-contained, já
/// desenha seu próprio fundo navy — funciona sobre o chrome navy do shell
/// ou sobre foto/overlay escuro); `background="light"` usa a variante
/// "claro" (transparente, texto navy — para fundo claro/branco).
///
/// `background="photo"` (FIT-131, pacote visual 2026) usa
/// `fitos-horizontal-foto.svg` — derivado do vetor "escuro" oficial com
/// somente o retângulo de fundo externo 438×160 removido (ícone, formas e
/// wordmark permanecem idênticos ao original, nunca redesenhados). Existe
/// exclusivamente para renderizar sobre fotografia com gradiente contínuo
/// na própria imagem — nunca usar `background="dark"` sobre foto, o
/// retângulo navy embutido nela cria a tarja retangular que esta variante
/// existe para evitar.
const HORIZONTAL_ASPECT_RATIO = 438 / 160;

const HORIZONTAL_SRC_BY_BACKGROUND: Record<BrandLogoBackground, string> = {
  dark: "/marca/fitos-horizontal-escuro.svg",
  light: "/marca/fitos-horizontal-claro.svg",
  photo: "/marca/fitos-horizontal-foto.svg",
};

export function BrandLogo({ variant = "horizontal", background = "dark", size = 32, title = "FitOS", decorative = false, className }: BrandLogoProps) {
  const alt = decorative ? "" : title;
  const classes = [styles.logo, className].filter(Boolean).join(" ");

  if (variant === "symbol") {
    return (
      <Image
        src="/marca/fitos-icone.svg"
        alt={alt}
        width={size}
        height={size}
        className={classes}
        aria-hidden={decorative ? true : undefined}
        unoptimized
      />
    );
  }

  const src = HORIZONTAL_SRC_BY_BACKGROUND[background];
  return (
    <Image
      src={src}
      alt={alt}
      width={Math.round(size * HORIZONTAL_ASPECT_RATIO)}
      height={size}
      className={classes}
      aria-hidden={decorative ? true : undefined}
      unoptimized
    />
  );
}
