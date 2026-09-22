"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, FormAlert } from "@/shared/ui";

export function DuplicarMeuTreinoButton({ workoutId }: { workoutId: string }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    setError(null);
    const response = await fetch(`/api/meus-treinos/${workoutId}/duplicar`, { method: "POST" });
    setIsSubmitting(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.message ?? "Não foi possível duplicar o treino. Tente novamente.");
      return;
    }

    const clone = await response.json();
    router.push(`/painel/meus-treinos/${clone.id}`);
    router.refresh();
  }

  return (
    <div>
      {error ? <FormAlert variant="error">{error}</FormAlert> : null}
      <Button type="button" variant="outlined" onClick={handleClick} disabled={isSubmitting}>
        {isSubmitting ? "Duplicando…" : "Duplicar treino"}
      </Button>
    </div>
  );
}
