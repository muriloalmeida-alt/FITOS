"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, FormAlert } from "@/shared/ui";

export function DuplicarModeloButton({ workoutId }: { workoutId: string }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    setError(null);
    const response = await fetch(`/api/workouts/${workoutId}/duplicar`, { method: "POST" });
    setIsSubmitting(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.message ?? "Não foi possível duplicar o modelo. Tente novamente.");
      return;
    }

    const clone = await response.json();
    router.push(`/painel/treinos/${clone.id}`);
    router.refresh();
  }

  return (
    <div>
      {error ? <FormAlert variant="error">{error}</FormAlert> : null}
      <Button type="button" variant="outlined" onClick={handleClick} disabled={isSubmitting}>
        {isSubmitting ? "Duplicando…" : "Duplicar modelo"}
      </Button>
    </div>
  );
}
