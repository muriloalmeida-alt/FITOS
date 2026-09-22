"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, FormAlert, TextField } from "@/shared/ui";
import styles from "./page.module.css";

export function EncerrarVinculoForm({ studentId }: { studentId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    setError(null);

    const response = await fetch(`/api/students/${studentId}/encerrar-vinculo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason.trim().length > 0 ? reason : null }),
    });
    setIsSubmitting(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.message ?? "Não foi possível encerrar o vínculo. Tente novamente.");
      return;
    }

    router.push(`/painel/alunos/${studentId}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error ? <FormAlert variant="error">{error}</FormAlert> : null}
      <TextField
        label="Motivo (opcional)"
        name="reason"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        disabled={isSubmitting}
      />
      <div className={styles.actions}>
        <Button type="submit" variant="filled" disabled={isSubmitting}>
          {isSubmitting ? "Encerrando…" : "Confirmar encerramento"}
        </Button>
        <Button href={`/painel/alunos/${studentId}`} variant="outlined">
          Cancelar
        </Button>
      </div>
    </form>
  );
}
