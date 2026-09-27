import { Button } from "./Button";
import styles from "./ErrorRecovery.module.css";

interface ErrorRecoveryProps {
  title?: string;
  description: string;
  retry?: { label?: string; onClick: () => void };
}

/// Estado de erro recuperável (docs/03-experience/UX-ARCHITECTURE.md —
/// "Falha recuperável com tentar novamente" é um dos estados sistêmicos
/// obrigatórios). Nunca um erro genérico técnico exposto ao usuário —
/// `description` é sempre texto funcional, escrito pelo chamador.
export function ErrorRecovery({ title = "Algo não funcionou como esperado", description, retry }: ErrorRecoveryProps) {
  return (
    <div className={styles.error} role="alert">
      <strong className={styles.title}>{title}</strong>
      <p className={styles.description}>{description}</p>
      {retry ? (
        <Button type="button" variant="outlined" onClick={retry.onClick} className={styles.retry}>
          {retry.label ?? "Tentar novamente"}
        </Button>
      ) : null}
    </div>
  );
}
