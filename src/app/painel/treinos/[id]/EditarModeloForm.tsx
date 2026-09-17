"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, FormAlert, TextField } from "@/shared/ui";
import styles from "./EditarModeloForm.module.css";

const DIAS_DA_SEMANA = ["SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA", "SABADO", "DOMINGO"] as const;

const DIA_LABEL: Record<string, string> = {
  SEGUNDA: "Seg",
  TERCA: "Ter",
  QUARTA: "Qua",
  QUINTA: "Qui",
  SEXTA: "Sex",
  SABADO: "Sáb",
  DOMINGO: "Dom",
};

interface EditarModeloFormProps {
  workoutId: string;
  initialName: string;
  initialSuggestedDays: string[];
}

interface FieldErrors {
  name?: string;
}

export function EditarModeloForm({ workoutId, initialName, initialSuggestedDays }: EditarModeloFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [suggestedDays, setSuggestedDays] = useState<string[]>(initialSuggestedDays);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function toggleDay(day: string) {
    setSuggestedDays((current) => (current.includes(day) ? current.filter((d) => d !== day) : [...current, day]));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    if (name.trim().length === 0) {
      setFieldErrors({ name: "Informe o nome do modelo de treino." });
      return;
    }
    setFieldErrors({});
    setFormError(null);
    setFormSuccess(null);

    setIsSubmitting(true);
    const response = await fetch(`/api/workouts/${workoutId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), suggestedDays }),
    });
    setIsSubmitting(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setFormError(body?.message ?? "Não foi possível salvar as alterações. Tente novamente.");
      return;
    }

    setFormSuccess("Alterações salvas.");
    router.refresh();
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {formError ? <FormAlert variant="error">{formError}</FormAlert> : null}
      {formSuccess ? <FormAlert variant="info">{formSuccess}</FormAlert> : null}

      <TextField
        label="Nome"
        name="name"
        type="text"
        value={name}
        onChange={(event) => setName(event.target.value)}
        error={fieldErrors.name}
        disabled={isSubmitting}
        required
      />

      <fieldset className={styles.daysField}>
        <legend className={styles.daysLegend}>Dias sugeridos</legend>
        <div className={styles.daysOptions}>
          {DIAS_DA_SEMANA.map((day) => (
            <label key={day} className={styles.dayOption}>
              <input
                type="checkbox"
                checked={suggestedDays.includes(day)}
                onChange={() => toggleDay(day)}
                disabled={isSubmitting}
              />
              {DIA_LABEL[day]}
            </label>
          ))}
        </div>
      </fieldset>

      <Button type="submit" variant="filled" disabled={isSubmitting}>
        {isSubmitting ? "Salvando…" : "Salvar alterações"}
      </Button>
    </form>
  );
}
