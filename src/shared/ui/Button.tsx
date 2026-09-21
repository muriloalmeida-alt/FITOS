import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";
import Link from "next/link";
import styles from "./Button.module.css";

type ButtonVariant = "filled" | "outlined";

interface ButtonAsButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  href?: undefined;
}

interface ButtonAsLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  variant?: ButtonVariant;
  href: string;
}

type ButtonProps = ButtonAsButtonProps | ButtonAsLinkProps;

/// Botão com a mesma aparência nos dois papéis que pode ter: ação (`<button>`)
/// ou navegação (`href`, `<Link>`). Nunca aninha um `<button>` dentro de um
/// `<a>` — HTML inválido que também duplica o elemento focável por teclado
/// para uma única ação (achado da varredura de acessibilidade da FIT-070) —
/// `variant="filled"`/`"outlined"` continuam a mesma aparência em ambos.
export function Button({ variant = "filled", className, href, ...props }: ButtonProps) {
  const variantClass = variant === "filled" ? styles.filled : styles.outlined;
  const classes = [styles.button, variantClass, className].filter(Boolean).join(" ");

  if (href !== undefined) {
    return <Link href={href} className={classes} {...(props as AnchorHTMLAttributes<HTMLAnchorElement>)} />;
  }

  return <button className={classes} {...(props as ButtonHTMLAttributes<HTMLButtonElement>)} />;
}
