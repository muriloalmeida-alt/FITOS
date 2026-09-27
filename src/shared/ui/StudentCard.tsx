import Link from "next/link";
import { Avatar } from "./Avatar";
import styles from "./StudentCard.module.css";

export type StudentCardStatusTone = "positive" | "warning" | "neutral";

interface StudentCardProps {
  name: string;
  statusLabel: string;
  statusTone: StudentCardStatusTone;
  description?: string;
  href?: string;
}

/// Cartão de aluno com identidade (docs/01-DIRECAO-VISUAL.md — "alunos são
/// pessoas acompanhadas, não linhas de tabela"). Substitui a linha de texto
/// simples usada hoje em `/painel/alunos`. Reaproveita `Avatar` (iniciais,
/// nunca foto — docs/06-GOVERNANCA-DE-MIDIA.md). `statusLabel` é sempre
/// texto (ex.: "Ativa", "Atenção"), nunca só a cor de `statusTone`.
export function StudentCard({ name, statusLabel, statusTone, description, href }: StudentCardProps) {
  const content = (
    <>
      <Avatar name={name} />
      <span className={styles.text}>
        <strong className={styles.name}>{name}</strong>
        {description ? <span className={styles.description}>{description}</span> : null}
      </span>
      <span className={`${styles.statusPill} ${styles[statusTone]}`}>{statusLabel}</span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={styles.card}>
        {content}
      </Link>
    );
  }

  return <div className={styles.card}>{content}</div>;
}
