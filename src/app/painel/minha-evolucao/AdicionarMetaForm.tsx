"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, FormAlert, TextField } from "@/shared/ui";
import styles from "./AdicionarMetaForm.module.css";

export function AdicionarMetaForm() {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    setError(null);

    const response = await fetch("/api/minhas-metas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description, targetDate: targetDate || null }),
    });
    setIsSubmitting(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.message ?? "Não foi possível salvar a meta. Tente novamente.");
      return;
    }

    setDescription("");
    setTargetDate("");
    router.refresh();
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {error ? <FormAlert variant="error">{error}</FormAlert> : null}
      <TextField
        label="Nova meta"
        name="description"
        placeholder="Ex.: Perder 5kg, correr 5km sem pausa"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        disabled={isSubmitting}
        required
      />
      <TextField
        label="Data-alvo (opcional)"
        name="targetDate"
        type="date"
        value={targetDate}
        onChange={(event) => setTargetDate(event.target.value)}
        disabled={isSubmitting}
      />
      <Button type="submit" variant="filled" disabled={isSubmitting}>
        {isSubmitting ? "Salvando…" : "Adicionar meta"}
      </Button>
    </form>
  );
}
