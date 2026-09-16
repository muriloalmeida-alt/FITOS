import type { ReactNode } from "react";
import styles from "./FormAlert.module.css";

type FormAlertVariant = "error" | "info";

interface FormAlertProps {
  variant?: FormAlertVariant;
  children: ReactNode;
}

export function FormAlert({ variant = "error", children }: FormAlertProps) {
  const variantClass = variant === "error" ? styles.error : styles.info;

  return (
    <div className={[styles.alert, variantClass].join(" ")} role="alert">
      {children}
    </div>
  );
}
