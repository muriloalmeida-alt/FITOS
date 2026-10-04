"use client";

import Link from "next/link";
import styles from "./SegmentedTabs.module.css";

export interface SegmentedTabItem<T extends string = string> {
  key: T;
  label: string;
  count?: number;
  /// Com `href`, a aba navega (uma rota por aba); sem ele, chama `onChange`.
  href?: string;
}

interface SegmentedTabsProps<T extends string> {
  label: string;
  items: SegmentedTabItem<T>[];
  value: T;
  onChange?: (key: T) => void;
}

/// Abas segmentadas (FIT-171): alternam a vista de uma mesma tela
/// (Treinos/Programas/Exercícios, Cobranças/Recorrentes, Treinos/Corpo/
/// Metas). Botões com `aria-pressed` quando mudam o estado local; links
/// com `aria-current="page"` quando cada aba é uma rota.
export function SegmentedTabs<T extends string>({ label, items, value, onChange }: SegmentedTabsProps<T>) {
  return (
    <div className={styles.tabs} role="group" aria-label={label}>
      {items.map((item) => {
        const active = item.key === value;
        const text = item.count === undefined ? item.label : `${item.label} · ${item.count}`;
        const className = active ? `${styles.tab} ${styles.active}` : styles.tab;
        if (item.href) {
          return (
            <Link key={item.key} href={item.href} className={className} aria-current={active ? "page" : undefined}>
              {text}
            </Link>
          );
        }
        return (
          <button key={item.key} type="button" className={className} aria-pressed={active} onClick={() => onChange?.(item.key)}>
            {text}
          </button>
        );
      })}
    </div>
  );
}
