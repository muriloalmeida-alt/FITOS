"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, FormAlert } from "@/shared/ui";

export function ArquivarMeuTreinoButton({ workoutId }: { workoutId: string }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    setError(null);
    const response = await fetch(`/api/meus-treinos/${workoutId}/arquivar`, { method: "POST" });
    setIsSubmitting(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.message ?? "Não foi possível arquivar o treino. Tente novamente.");
      return;
    }

    router.refresh();
  }

  return (
    <div>
      {error ? <FormAlert variant="error">{error}</FormAlert> : null}
      <Button type="button" variant="outlined" onClick={handleClick} disabled={isSubmitting}>
        {isSubmitting ? "Arquivando…" : "Arquivar treino"}
      </Button>
    </div>
  );
}
