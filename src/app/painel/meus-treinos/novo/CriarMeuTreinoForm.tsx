"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, FormAlert, TextField } from "@/shared/ui";

interface FieldErrors {
  name?: string;
}

export function CriarMeuTreinoForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
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

    setIsSubmitting(true);
    const response = await fetch("/api/meus-treinos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    setIsSubmitting(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setFormError(body?.message ?? "Não foi possível criar o treino. Tente novamente.");
      return;
    }

    const workout = await response.json();
    router.push(`/painel/meus-treinos/${workout.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {formError ? <FormAlert variant="error">{formError}</FormAlert> : null}

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
        {isSubmitting ? "Criando…" : "Criar treino"}
      </Button>
    </form>
  );
}
