import type { ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

type ButtonVariant = "filled" | "outlined";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({ variant = "filled", className, ...props }: ButtonProps) {
  const variantClass = variant === "filled" ? styles.filled : styles.outlined;
  const classes = [styles.button, variantClass, className].filter(Boolean).join(" ");

  return <button className={classes} {...props} />;
}
