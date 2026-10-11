import styles from "./Skeleton.module.css";

interface SkeletonProps {
  width?: string;
  height?: string;
  radius?: string;
}

/// Bloco de carregamento no formato do conteúdo (FIT-171) — nunca um
/// spinner solto. Decorativo para leitores de tela.
export function Skeleton({ width = "100%", height = "16px", radius = "12px" }: SkeletonProps) {
  return <span className={styles.skeleton} style={{ width, height, borderRadius: radius }} aria-hidden="true" />;
}

/// Esqueleto padrão de uma tela do painel (título, cartão e linhas).
export function SkeletonScreen({ label = "Carregando" }: { label?: string }) {
  return (
    <div className={styles.screen} role="status" aria-live="polite">
      <span className={styles.srOnly}>{label}…</span>
      <Skeleton width="70%" height="34px" />
      <Skeleton width="50%" height="16px" />
      <span className={styles.gap} />
      <Skeleton height="120px" radius="20px" />
      <Skeleton height="64px" />
      <Skeleton height="64px" />
      <Skeleton height="64px" />
    </div>
  );
}
