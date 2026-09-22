import { useId, type SelectHTMLAttributes } from "react";
import styles from "./SelectField.module.css";

interface SelectFieldOption {
  value: string;
  label: string;
}

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> {
  label: string;
  options: SelectFieldOption[];
  placeholder?: string;
  error?: string;
}

/// Mesmo padrão de label/erro/altura mínima de toque (48px) de `TextField`,
/// para os campos de escolha do onboarding "Treino sozinho" (FIT-101) —
/// nenhum componente de seleção existia no kit compartilhado antes desta
/// História.
export function SelectField({ label, options, placeholder, error, className, ...props }: SelectFieldProps) {
  const generatedId = useId();
  const selectId = props.name ? `field-${props.name}` : generatedId;
  const errorId = `${selectId}-error`;

  return (
    <div className={[styles.field, className].filter(Boolean).join(" ")}>
      <label className={styles.label} htmlFor={selectId}>
        {label}
      </label>
      <select
        id={selectId}
        className={styles.select}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...props}
      >
        {placeholder ? (
          <option value="" disabled hidden>
            {placeholder}
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
