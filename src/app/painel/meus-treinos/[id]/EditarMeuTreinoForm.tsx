"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, FormAlert, TextField } from "@/shared/ui";

interface EditarMeuTreinoFormProps {
  workoutId: string;
  initialName: string;
}

interface FieldErrors {
  name?: string;
}

/// Sem "dias sugeridos" — conceito de agenda do personal/aluno sem uso
/// aqui (o praticante decide quando treina).
export function EditarMeuTreinoForm({ workoutId, initialName }: EditarMeuTreinoFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
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
      setFieldErrors({ name: "Informe o nome do treino." });
      return;
    }
    setFieldErrors({});
    setFormError(null);
    setFormSuccess(null);

    setIsSubmitting(true);
    const response = await fetch(`/api/meus-treinos/${workoutId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
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
    <form onSubmit={handleSubmit} noValidate>
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

      <Button type="submit" variant="filled" disabled={isSubmitting}>
        {isSubmitting ? "Salvando…" : "Salvar alterações"}
      </Button>
    </form>
  );
}
