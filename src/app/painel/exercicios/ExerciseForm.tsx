"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ChipGroup, FormAlert, Sheet, TextField, useToast } from "@/shared/ui";
import { requestJson } from "../_workout-builder/apiClient";
import styles from "./ExerciseForm.module.css";

export interface ExerciseFormValues {
  name: string;
  muscle: string | null;
  equipments: string | null;
  type: string | null;
  instructions: string;
}

const EQUIPMENTS = ["peso corporal", "halteres", "barra", "máquina", "polia", "elástico", "colchonete", "banco"];

interface ExerciseFormSheetProps {
  open: boolean;
  onClose: () => void;
  /// Sem `exerciseId`: cadastrar; com: editar.
  exerciseId?: string;
  initial?: ExerciseFormValues;
  muscles: string[];
  types: string[];
}

/// Cadastrar/editar exercício próprio numa sheet (FIT-147): só o nome é
/// digitado; músculo, equipamento e tipo são chips; "Como executar" é
/// opcional.
export function ExerciseFormSheet({ open, onClose, exerciseId, initial, muscles, types }: ExerciseFormSheetProps) {
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState<ExerciseFormValues>(initial ?? { name: "", muscle: null, equipments: null, type: null, instructions: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const equipmentOptions = values.equipments && !EQUIPMENTS.includes(values.equipments) ? [values.equipments, ...EQUIPMENTS] : EQUIPMENTS;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const body = JSON.stringify({ name: values.name, muscle: values.muscle ?? "", equipments: values.equipments ?? "", type: values.type ?? "", instructions: values.instructions });
      const saved = exerciseId
        ? await requestJson<{ id: string }>(`/api/exercises/${exerciseId}`, { method: "PATCH", body })
        : await requestJson<{ id: string }>("/api/exercises", { method: "POST", body });
      toast.show(exerciseId ? "Exercício atualizado" : "Exercício cadastrado. Já aparece na biblioteca dos treinos.");
      onClose();
      if (!exerciseId) router.push(`/painel/exercicios/${saved.id}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={exerciseId ? "Editar exercício" : "Novo exercício"}
      footer={
        <>
          <Button type="button" block disabled={saving || !values.name.trim() || !values.muscle} onClick={() => void save()}>
            {saving ? "Salvando…" : "Salvar exercício"}
          </Button>
          <Button type="button" variant="quiet" block onClick={onClose}>
            Cancelar
          </Button>
        </>
      }
    >
      <div className={styles.fields}>
        {error ? <FormAlert>{error}</FormAlert> : null}
        <TextField label="Nome" value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} placeholder="Ex.: Agachamento no banco" maxLength={120} />
        <ChipGroup label="Músculo principal" showLabel tone="accent" value={values.muscle} onChange={(muscle) => setValues({ ...values, muscle })} options={muscles.map((m) => ({ value: m, label: m }))} />
        <ChipGroup label="Equipamento" showLabel tone="accent" value={values.equipments} allowDeselect onClear={() => setValues({ ...values, equipments: null })} onChange={(equipments) => setValues({ ...values, equipments })} options={equipmentOptions.map((e) => ({ value: e, label: e }))} />
        <ChipGroup label="Tipo" showLabel tone="accent" value={values.type} allowDeselect onClear={() => setValues({ ...values, type: null })} onChange={(type) => setValues({ ...values, type })} options={types.map((t) => ({ value: t, label: t }))} />
        <label className={styles.textareaField}>
          <span className={styles.label}>Como executar (opcional)</span>
          <textarea className={styles.textarea} value={values.instructions} onChange={(event) => setValues({ ...values, instructions: event.target.value })} placeholder="Um passo por frase" maxLength={2000} />
        </label>
      </div>
    </Sheet>
  );
}
