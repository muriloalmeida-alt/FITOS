import { initialsFromName } from "@/shared/lib/initials";
import styles from "./Avatar.module.css";

interface AvatarProps {
  name: string;
  className?: string;
}

/**
 * Avatar neutro por iniciais (docs/06-GOVERNANCA-DE-MIDIA.md do pacote de
 * redesign): nunca uma foto de banco/IA representando um aluno real.
 * Reforça "alunos são pessoas acompanhadas, não linhas de tabela"
 * (docs/01-DIRECAO-VISUAL.md).
 */
export function Avatar({ name, className }: AvatarProps) {
  const classes = [styles.avatar, className].filter(Boolean).join(" ");
  return (
    <span className={classes} aria-hidden="true">
      {initialsFromName(name)}
    </span>
  );
}
