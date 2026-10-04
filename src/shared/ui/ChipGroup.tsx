"use client";

import type { ReactNode } from "react";
import styles from "./ChipGroup.module.css";

export interface ChipOption<T extends string = string> {
  value: T;
  label: ReactNode;
  /// Texto de apoio (só na variante "card").
  description?: ReactNode;
  disabled?: boolean;
}

interface ChipGroupBaseProps<T extends string> {
  /// Nome acessível do grupo (ex.: "Forma de pagamento").
  label: string;
  /// Mostra `label` como rótulo visível acima das opções.
  showLabel?: boolean;
  options: ChipOption<T>[];
  /// "chip": pílulas que quebram linha; "scroll": pílulas em uma linha com
  /// rolagem horizontal (filtros); "card": cartões em grade (onboarding).
  variant?: "chip" | "scroll" | "card";
  /// Cor do item marcado: "light" (filtro, branco) ou "accent" (escolha, laranja).
  tone?: "light" | "accent";
  columns?: 1 | 2 | 3;
}

interface SingleProps<T extends string> extends ChipGroupBaseProps<T> {
  multiple?: false;
  value: T | null;
  onChange: (value: T) => void;
  /// Permite desmarcar tocando de novo (filtros opcionais).
  allowDeselect?: boolean;
  onClear?: () => void;
}

interface MultipleProps<T extends string> extends ChipGroupBaseProps<T> {
  multiple: true;
  value: T[];
  onChange: (value: T[]) => void;
}

type ChipGroupProps<T extends string> = SingleProps<T> | MultipleProps<T>;

/// Escolha por toque (FIT-171, EPIC-23): substitui `<select>` e grupos de
/// rádio por chips ou cartões. Seleção única é um `radiogroup` (cada opção
/// `role="radio"` com `aria-checked`); seleção múltipla usa botões com
/// `aria-pressed`. Alvo de toque ≥ 44 px.
export function ChipGroup<T extends string>(props: ChipGroupProps<T>) {
  const { label, showLabel = false, options, variant = "chip", tone = "accent", columns = 2 } = props;
  const listClass = [styles.list, styles[variant], variant === "card" ? styles[`cols${columns}`] : null].filter(Boolean).join(" ");

  function isSelected(value: T) {
    return props.multiple ? props.value.includes(value) : props.value === value;
  }

  function toggle(value: T) {
    if (props.multiple) {
      props.onChange(props.value.includes(value) ? props.value.filter((item) => item !== value) : [...props.value, value]);
      return;
    }
    if (props.value === value && props.allowDeselect) {
      props.onClear?.();
      return;
    }
    props.onChange(value);
  }

  return (
    <div className={styles.group}>
      {showLabel ? <span className={styles.groupLabel}>{label}</span> : null}
      <div className={listClass} role={props.multiple ? "group" : "radiogroup"} aria-label={label}>
        {options.map((option) => {
          const selected = isSelected(option.value);
          const itemClass = [variant === "card" ? styles.card : styles.chip, selected ? styles.selected : null, selected ? styles[tone] : null]
            .filter(Boolean)
            .join(" ");
          return (
            <button
              key={option.value}
              type="button"
              className={itemClass}
              disabled={option.disabled}
              role={props.multiple ? undefined : "radio"}
              aria-checked={props.multiple ? undefined : selected}
              aria-pressed={props.multiple ? selected : undefined}
              onClick={() => toggle(option.value)}
            >
              <span className={styles.optionLabel}>{option.label}</span>
              {variant === "card" && option.description ? <span className={styles.optionDescription}>{option.description}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
