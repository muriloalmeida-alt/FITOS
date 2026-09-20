"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, FormAlert, TextField } from "@/shared/ui";

interface FieldErrors {
  name?: string;
}

export function CriarPlanoForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [durationWeeks, setDurationWeeks] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
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

    setIsSubmitting(true);
    const trimmedDuration = durationWeeks.trim();
    const response = await fetch("/api/training-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        durationWeeks: trimmedDuration ? Number.parseInt(trimmedDuration, 10) : undefined,
      }),
    });
    setIsSubmitting(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setFormError(body?.message ?? "Não foi possível criar o programa. Tente novamente.");
      return;
    }

    const plan = await response.json();
    router.push(`/painel/treinos/planos/${plan.id}`);
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
        {isSubmitting ? "Criando…" : "Criar programa"}
      </Button>
    </form>
  );
}
