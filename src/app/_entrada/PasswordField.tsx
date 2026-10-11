"use client";

import { useState } from "react";
import { TextField } from "@/shared/ui";
import styles from "./Entrada.module.css";

/// Senha com "Mostrar" (FIT-163/164/165): sem campo de confirmação.
export function PasswordField(props: { label?: string; value: string; onChange: (value: string) => void; error?: string; autoComplete: "current-password" | "new-password"; disabled?: boolean }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={styles.passwordRow}>
      <TextField
        label={props.label ?? "Senha"}
        name="password"
        type={visible ? "text" : "password"}
        autoComplete={props.autoComplete}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        error={props.error}
        disabled={props.disabled}
        required
      />
      <button type="button" className={styles.toggle} aria-pressed={visible} onClick={() => setVisible(!visible)}>
        {visible ? "Ocultar" : "Mostrar"}
      </button>
    </div>
  );
}
