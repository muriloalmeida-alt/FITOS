"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, FormAlert, TextField } from "@/shared/ui";
import styles from "./EditarExercicioForm.module.css";

interface EditarExercicioFormProps {
  exerciseId: string;
  initialName: string;
  initialType: string;
  initialMuscle: string;
  initialEquipments: string;
  initialInstructions: string;
}

interface FieldErrors {
  name?: string;
}

export function EditarExercicioForm({
  exerciseId,
  initialName,
  initialType,
  initialMuscle,
  initialEquipments,
  initialInstructions,
}: EditarExercicioFormProps) {
  const router = useRouter();
  const instructionsId = useId();
  const [name, setName] = useState(initialName);
  const [type, setType] = useState(initialType);
  const [muscle, setMuscle] = useState(initialMuscle);
  const [equipments, setEquipments] = useState(initialEquipments);
  const [instructions, setInstructions] = useState(initialInstructions);
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
      setFieldErrors({ name: "Informe o nome do exercício." });
      return;
    }
    setFieldErrors({});
    setFormError(null);
    setFormSuccess(null);

    setIsSubmitting(true);
    const response = await fetch(`/api/exercises/${exerciseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        type: type.trim(),
        muscle: muscle.trim(),
        equipments: equipments.trim(),
        instructions: instructions.trim(),
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
        label="Tipo/categoria"
        name="type"
        type="text"
        value={type}
        onChange={(event) => setType(event.target.value)}
        disabled={isSubmitting}
      />
      <TextField
        label="Músculo principal"
        name="muscle"
        type="text"
        value={muscle}
        onChange={(event) => setMuscle(event.target.value)}
        disabled={isSubmitting}
      />
      <TextField
        label="Equipamento"
        name="equipments"
        type="text"
        value={equipments}
        onChange={(event) => setEquipments(event.target.value)}
        disabled={isSubmitting}
      />
      <div className={styles.textareaField}>
        <label className={styles.textareaLabel} htmlFor={instructionsId}>
          Instruções
        </label>
        <textarea
          id={instructionsId}
          className={styles.textarea}
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
          disabled={isSubmitting}
        />
      </div>

      <Button type="submit" variant="filled" disabled={isSubmitting}>
        {isSubmitting ? "Salvando…" : "Salvar alterações"}
      </Button>
    </form>
  );
}
