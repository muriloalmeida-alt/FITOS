import { initialsFromName } from "@/shared/lib/initials";
import styles from "./Avatar.module.css";

interface AvatarProps {
  name: string;
  /// Foto de perfil enviada pela própria pessoa (EPIC-35); sem foto, iniciais.
  src?: string | null;
  className?: string;
}

/**
 * Avatar neutro por iniciais (docs/06-GOVERNANCA-DE-MIDIA.md do pacote de
 * redesign): nunca uma foto de banco/IA representando um aluno real.
 * Reforça "alunos são pessoas acompanhadas, não linhas de tabela"
 * (docs/01-DIRECAO-VISUAL.md). A foto, quando existe, é sempre a que a
 * própria pessoa enviou no perfil (EPIC-35).
 */
export function Avatar({ name, src, className }: AvatarProps) {
  const classes = [styles.avatar, className].filter(Boolean).join(" ");
  return (
    <span className={classes} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- foto privada, servida por rota autenticada (EPIC-35) */}
      {src ? <img src={src} alt="" className={styles.photo} /> : initialsFromName(name)}
    </span>
  );
}
