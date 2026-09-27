import type { ReactNode } from "react";
import { Button } from "./Button";
import styles from "./EmptyStateAction.module.css";

interface EmptyStateActionAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface EmptyStateActionProps {
  title: string;
  description?: string;
  action?: EmptyStateActionAction;
  icon?: ReactNode;
}

/// Estado vazio com ação (docs/03-experience/UX-ARCHITECTURE.md — "Inicial/
/// sem dados" é um dos estados sistêmicos obrigatórios). Substitui os
/// parágrafos soltos ("Nenhum X ainda") usados hoje em Alunos, Exercícios,
/// Treinos, Financeiro e nas telas do aluno — sempre com um convite claro
/// à próxima ação, nunca só a ausência anunciada.
export function EmptyStateAction({ title, description, action, icon }: EmptyStateActionProps) {
  return (
    <div className={styles.empty}>
      {icon ? (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <strong className={styles.title}>{title}</strong>
      {description ? <p className={styles.description}>{description}</p> : null}
      {action?.href ? (
        <Button href={action.href} variant="filled" className={styles.action}>
          {action.label}
        </Button>
      ) : null}
      {action && !action.href ? (
        <Button type="button" onClick={action.onClick} variant="filled" className={styles.action}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}
