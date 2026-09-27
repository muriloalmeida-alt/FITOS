"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, FormAlert, TextField } from "@/shared/ui";

export function CancelarAssinaturaForm() {
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

    const response = await fetch("/api/tenancy/minha-assinatura/cancelar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    setIsSubmitting(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.message ?? "Não foi possível cancelar a assinatura. Tente novamente.");
      return;
    }

    setReason("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error ? <FormAlert variant="error">{error}</FormAlert> : null}
      <TextField
        label="Motivo do cancelamento"
        name="reason"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        disabled={isSubmitting}
      />
      <Button type="submit" variant="outlined" disabled={isSubmitting}>
        {isSubmitting ? "Cancelando…" : "Cancelar assinatura"}
      </Button>
    </form>
  );
}
