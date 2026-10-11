"use client";

import type { ReactNode } from "react";
import styles from "./Switch.module.css";

interface SwitchProps {
  label: string;
  description?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon?: ReactNode;
}

/// Liga/desliga (FIT-171): linha inteira clicável com `role="switch"`.
export function Switch({ label, description, checked, onChange, icon }: SwitchProps) {
  return (
    <button type="button" role="switch" aria-checked={checked} className={styles.row} onClick={() => onChange(!checked)}>
      {icon ? <span className={styles.icon}>{icon}</span> : null}
      <span className={styles.text}>
        <span className={styles.label}>{label}</span>
        {description ? <span className={styles.description}>{description}</span> : null}
      </span>
      <span className={checked ? `${styles.track} ${styles.on}` : styles.track} aria-hidden="true">
        <span className={styles.knob} />
      </span>
    </button>
  );
}
