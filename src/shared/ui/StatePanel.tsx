import type { ReactNode } from "react";
import { Button } from "./Button";
import styles from "./StatePanel.module.css";

interface StateAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface StatePanelProps {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  primary?: StateAction;
  secondary?: StateAction;
  /// "alert" só para falha recuperável; os demais estados são informativos.
  role?: "alert" | "status";
  /// "danger" pinta o eyebrow em vermelho claro (erro, sem permissão).
  tone?: "default" | "danger";
  /// Centraliza na tela inteira (páginas de erro/404 fora do painel).
  fullscreen?: boolean;
}

function ActionButton({ action, variant }: { action: StateAction; variant: "filled" | "secondary" }) {
  if (action.href) {
    return (
      <Button href={action.href} variant={variant} block>
        {action.label}
      </Button>
    );
  }
  return (
    <Button type="button" variant={variant} block onClick={action.onClick}>
      {action.label}
    </Button>
  );
}

/// Estados do sistema (FIT-171, S1 do protótipo): erro de conexão, não
/// encontrado, sem permissão e limite do plano. Sempre diz o que
/// aconteceu e oferece a saída — nunca um erro técnico exposto.
export function StatePanel({ eyebrow, title, description, primary, secondary, role, tone = "default", fullscreen = false }: StatePanelProps) {
  return (
    <section className={fullscreen ? `${styles.panel} ${styles.fullscreen}` : styles.panel} role={role}>
      <div className={styles.inner}>
        <p className={tone === "danger" ? `${styles.eyebrow} ${styles.danger}` : styles.eyebrow}>{eyebrow}</p>
        <h1 className={styles.title}>{title}</h1>
        {description ? <p className={styles.description}>{description}</p> : null}
        {primary || secondary ? (
          <div className={styles.actions}>
            {primary ? <ActionButton action={primary} variant="filled" /> : null}
            {secondary ? <ActionButton action={secondary} variant="secondary" /> : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

/// Limite de alunos do plano atingido (FIT-171): saída para trocar de plano
/// ou liberar vaga inativando alguém.
export function PlanLimitState({ planName, maxStudents }: { planName: string; maxStudents: number }) {
  return (
    <StatePanel
      eyebrow="Limite do plano"
      title="Seu plano está cheio."
      description={`${planName} permite até ${maxStudents} alunos ativos. Inative alguém ou troque de plano para convidar mais.`}
      primary={{ label: "Ver planos", href: "/painel/assinatura" }}
      secondary={{ label: "Gerenciar alunos", href: "/painel/alunos" }}
    />
  );
}
