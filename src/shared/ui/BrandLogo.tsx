import styles from "./BrandLogo.module.css";

export type BrandLogoVariant = "horizontal" | "symbol";
export type BrandLogoBackground = "dark" | "light";

interface BrandLogoProps {
  variant?: BrandLogoVariant;
  background?: BrandLogoBackground;
  size?: number;
  /** Só usado em `variant="symbol"` (sem texto próprio) — nome acessível quando não decorativo. Default `"FitOS"`. */
  title?: string;
  /** Marca o símbolo como puramente decorativo (`aria-hidden`) — usar quando o contexto ao redor (ex.: um link "FitOS" já com texto) já nomeia a marca. Default `false`. */
  decorative?: boolean;
  className?: string;
}

/// Marca gráfica do FitOS (FIT-117, docs/03-design/APLICACAO-DA-MARCA-EM-CODIGO.md
/// e benchmark §5.2: wordmark "Fit" médio + "OS" forte, símbolo isolado para
/// ícones). Proposta inicial deste componente — nenhum arquivo de logo
/// vetorial aprovado existia no repositório; o símbolo reaproveita fielmente
/// o ícone já estabelecido no protótipo navegável do pacote (mesma silhueta
/// de pulso dentro de um quadrado arredondado, já usada como favicon ali),
/// não uma invenção nova. Pendente aprovação explícita antes de virar
/// definitivo — ver ADR/registro do PR desta História.
///
/// `variant="horizontal"`: símbolo + texto real em DOM (nunca texto dentro
/// de `<svg>`) — o texto já é acessível por si só, então o símbolo ao lado
/// é sempre decorativo (`aria-hidden`). `variant="symbol"`: só o ícone,
/// usado em contextos compactos (ex.: avatar de app) — `title`/`decorative`
/// controlam o nome acessível nesse caso.
export function BrandLogo({ variant = "horizontal", background = "dark", size = 32, title = "FitOS", decorative = false, className }: BrandLogoProps) {
  const classes = [styles.logo, styles[background], className].filter(Boolean).join(" ");
  const symbol = (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={styles.symbol}
      role={variant === "symbol" && !decorative ? "img" : undefined}
      aria-hidden={variant === "horizontal" || decorative ? true : undefined}
      aria-label={variant === "symbol" && !decorative ? title : undefined}
    >
      <rect width={64} height={64} rx={16} className={styles.symbolBg} />
      <path
        d="M15 34h8l4-12 8 25 5-13h9"
        fill="none"
        className={styles.symbolPath}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  if (variant === "symbol") {
    return <span className={classes}>{symbol}</span>;
  }

  return (
    <span className={classes} style={{ fontSize: size * 0.6 }}>
      {symbol}
      <span className={styles.wordmark}>
        Fit<span className={styles.wordmarkStrong}>OS</span>
      </span>
    </span>
  );
}
