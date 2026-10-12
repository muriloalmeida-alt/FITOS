"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, FormAlert, useToast } from "@/shared/ui";
import { modalitiesLabel, type Modality } from "@/shared/lib/modalities";
import { ModalityPicker } from "../../_modalidades/ModalityPicker";
import styles from "./ProfileParts.module.css";

/// Modalidades em Perfil → Meu treino (proposta 11): mostra as escolhas e
/// edita com a mesma seleção do onboarding. Só salva com "Salvar"; o
/// programa ativo nunca muda por causa disso.
export function ModalitiesEditor({ value, note }: { value: Modality[]; note: string }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Modality[]>(value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/minhas-modalidades", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ modalities: draft }) }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      setError("Não foi possível salvar. Tente de novo.");
      return;
    }
    setEditing(false);
    toast.show("Modalidades salvas");
    router.refresh();
  }

  if (!editing) {
    return (
      <div className={styles.form} role="group" aria-label="Modalidades">
        <p className={styles.note}>
          <strong className={styles.switchTitle}>Modalidades: </strong>
          {value.length > 0 ? modalitiesLabel(value) : "ainda não escolhidas"}
        </p>
        <Button type="button" variant="secondary" block onClick={() => { setDraft(value); setError(null); setEditing(true); }}>
          {value.length > 0 ? "Editar modalidades" : "Escolher modalidades"}
        </Button>
      </div>
    );
  }
  return (
    <div className={styles.form} role="group" aria-label="Editar modalidades">
      <p className={styles.note}>Escolha uma ou mais opções. {note}</p>
      <ModalityPicker value={draft} onChange={setDraft} disabled={busy} />
      {error ? <FormAlert>{error}</FormAlert> : null}
      <Button type="button" block disabled={busy || draft.length === 0} onClick={() => void save()}>
        {busy ? "Salvando…" : "Salvar modalidades"}
      </Button>
      <Button type="button" variant="quiet" block onClick={() => setEditing(false)}>
        Cancelar
      </Button>
    </div>
  );
}
