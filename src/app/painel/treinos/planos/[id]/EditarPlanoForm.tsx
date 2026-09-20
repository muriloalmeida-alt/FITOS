"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, FormAlert, TextField } from "@/shared/ui";
import styles from "./EditarPlanoForm.module.css";

interface EditarPlanoFormProps {
  trainingPlanId: string;
  initialName: string;
  initialDurationWeeks: number | null;
}

interface FieldErrors {
  name?: string;
}

export function EditarPlanoForm({ trainingPlanId, initialName, initialDurationWeeks }: EditarPlanoFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [durationWeeks, setDurationWeeks] = useState(initialDurationWeeks?.toString() ?? "");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    if (name.trim().length === 0) {
      setFieldErrors({ name: "Informe o nome do programa." });
      return;
    }
    setFieldErrors({});
    setFormError(null);
    setFormSuccess(null);

    setIsSubmitting(true);
    const trimmedDuration = durationWeeks.trim();
    const response = await fetch(`/api/training-plans/${trainingPlanId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        durationWeeks: trimmedDuration ? Number.parseInt(trimmedDuration, 10) : null,
      }),
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
      <TextField
        label="Vigência sugerida (semanas)"
        name="durationWeeks"
        type="number"
        min={1}
        value={durationWeeks}
        onChange={(event) => setDurationWeeks(event.target.value)}
        disabled={isSubmitting}
      />

      <Button type="submit" variant="filled" disabled={isSubmitting}>
        {isSubmitting ? "Salvando…" : "Salvar alterações"}
      </Button>
    </form>
  );
}
