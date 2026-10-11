import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";
import Link from "next/link";
import styles from "./Button.module.css";

/// `danger` (AjustesTelas, 29/09/2026 — telas 10/11): confirmação de ação
/// destrutiva (inativar aluno, encerrar vínculo) nunca usa o mesmo laranja
/// positivo da ação principal.
///
/// FIT-171 (EPIC-23): `secondary` é o botão escuro elevado do protótipo
/// (ação secundária ao lado da principal) e `quiet` é a ação de texto
/// (link laranja). `size` "lg"/"xl" atende a execução de treino, em que
/// o alvo de toque precisa ser grande (≥ 60 px); `block` ocupa a largura.
type ButtonVariant = "filled" | "outlined" | "danger" | "secondary" | "quiet";
type ButtonSize = "md" | "lg" | "xl";

interface ButtonStyleProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
}

interface ButtonAsButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonStyleProps {
  href?: undefined;
}

interface ButtonAsLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">, ButtonStyleProps {
  href: string;
}

type ButtonProps = ButtonAsButtonProps | ButtonAsLinkProps;

/// Botão com a mesma aparência nos dois papéis que pode ter: ação (`<button>`)
/// ou navegação (`href`, `<Link>`). Nunca aninha um `<button>` dentro de um
/// `<a>` — HTML inválido que também duplica o elemento focável por teclado
/// para uma única ação (achado da varredura de acessibilidade da FIT-070) —
/// `variant="filled"`/`"outlined"` continuam a mesma aparência em ambos.
export function Button({ variant = "filled", size = "md", block = false, className, href, ...props }: ButtonProps) {
  const classes = [styles.button, styles[variant], size !== "md" ? styles[size] : null, block ? styles.block : null, className]
    .filter(Boolean)
    .join(" ");

  if (href !== undefined) {
    return <Link href={href} className={classes} {...(props as AnchorHTMLAttributes<HTMLAnchorElement>)} />;
  }

  return <button className={classes} {...(props as ButtonHTMLAttributes<HTMLButtonElement>)} />;
}
