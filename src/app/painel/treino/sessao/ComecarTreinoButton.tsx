"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, FormAlert } from "@/shared/ui";

export function ComecarTreinoButton({ workoutId }: { workoutId: string }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (isSubmitting) {
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/workout-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workoutId }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.message ?? "Não foi possível iniciar o treino. Tente novamente.");
        setIsSubmitting(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Falha de conexão. Verifique sua internet e tente novamente.");
      setIsSubmitting(false);
    }
  }

  return (
    <>
      {error ? <FormAlert variant="error">{error}</FormAlert> : null}
      <Button type="button" variant="filled" onClick={handleClick} disabled={isSubmitting}>
        {isSubmitting ? "Começando…" : "Começar treino"}
      </Button>
    </>
  );
}
