import styles from "./CardioIcon.module.css";

/// Aeróbico não tem foto de execução: um ícone de pulso no lugar da
/// miniatura (EPIC-28). `size` em px, quadrado.
export function CardioIcon({ size = 48, label }: { size?: number; label?: string }) {
  return (
    <span className={styles.icon} style={{ width: size, height: size }} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <svg width={Math.round(size * 0.5)} height={Math.round(size * 0.5)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12h4l2-5 4 10 2-5h6" />
      </svg>
    </span>
  );
}
