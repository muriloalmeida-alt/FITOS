import styles from "./PulseLine.module.css";

export type PulseLineVariant = "brand" | "progress" | "loading" | "divider" | "static";

interface PulseLineProps {
  variant?: PulseLineVariant;
  /** Só relevante na variante `progress`: 0-100. Nunca é a única forma de comunicar o valor — sempre acompanhado de texto pelo consumidor do componente. */
  value?: number;
  /** Rótulo acessível. Omitir mantém o padrão (`aria-hidden`) — a linha é decorativa por padrão em todas as variantes. */
  label?: string;
  className?: string;
}

const PATH = "M0,20 L64,20 L82,4 L100,36 L118,20 L240,20";
const VIEW_BOX = "0 0 240 40";

/**
 * PulseLine — componente proprietário do redesign "Evolução em movimento"
 * (docs/03-COMPONENTES-E-TOKENS.md do pacote de redesign). SVG/code-native
 * (nunca bitmap); decorativo por padrão (`aria-hidden`), a menos que
 * `label` seja informado. A variante `progress` nunca deve ser a única
 * forma de comunicar um valor — o consumidor sempre acompanha de texto.
 */
export function PulseLine({ variant = "static", value, label, className }: PulseLineProps) {
  const clampedValue = variant === "progress" ? Math.min(100, Math.max(0, value ?? 100)) : null;
  const classes = [styles.pulseLine, styles[variant], className].filter(Boolean).join(" ");

  return (
    <svg
      className={classes}
      viewBox={VIEW_BOX}
      preserveAspectRatio="none"
      role={label ? "img" : undefined}
      aria-hidden={label ? undefined : true}
      aria-label={label}
    >
      <path
        d={PATH}
        className={styles.track}
        style={clampedValue !== null ? { strokeDasharray: 240, strokeDashoffset: 240 - (240 * clampedValue) / 100 } : undefined}
      />
    </svg>
  );
}
