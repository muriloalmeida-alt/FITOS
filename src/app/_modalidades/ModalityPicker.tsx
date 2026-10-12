"use client";

import { MODALITIES, MODALITY_HINT, MODALITY_LABEL, type Modality } from "@/shared/lib/modalities";
import styles from "./ModalityPicker.module.css";

/// "Quais modalidades você quer praticar?" (proposta 11): cartões de
/// seleção múltipla, a área toda clicável, estado exposto (`role=checkbox`
/// + `aria-checked`) e indicado também por texto/ícone, não só pela cor.
/// Mesmo componente no onboarding do Livre, no convite do aluno e no Perfil.
export function ModalityPicker({ value, onChange, disabled = false }: { value: Modality[]; onChange: (next: Modality[]) => void; disabled?: boolean }) {
  function toggle(modality: Modality) {
    const next = value.includes(modality) ? value.filter((entry) => entry !== modality) : [...value, modality];
    onChange(MODALITIES.filter((entry) => next.includes(entry)));
  }
  return (
    <div className={styles.cards} role="group" aria-label="Modalidades">
      {MODALITIES.map((modality) => {
        const on = value.includes(modality);
        return (
          <button key={modality} type="button" role="checkbox" aria-checked={on} disabled={disabled} className={on ? `${styles.card} ${styles.on}` : styles.card} onClick={() => toggle(modality)}>
            <span className={styles.text}>
              <span className={styles.title}>{MODALITY_LABEL[modality]}</span>
              <span className={styles.hint}>{MODALITY_HINT[modality]}</span>
            </span>
            <span className={on ? `${styles.mark} ${styles.markOn}` : styles.mark} aria-hidden="true">
              {on ? "✓" : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}
