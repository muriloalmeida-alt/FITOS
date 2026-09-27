import styles from "./MediaAttribution.module.css";

interface MediaAttributionProps {
  credit: string;
}

/// Crédito discreto de mídia (docs/06-GOVERNANCA-DE-MIDIA.md — toda foto
/// editorial/de marca usada no produto precisa de atribuição rastreável
/// quando aplicável). Nunca chamativo — texto pequeno, canto da imagem.
export function MediaAttribution({ credit }: MediaAttributionProps) {
  return <span className={styles.attribution}>{credit}</span>;
}
