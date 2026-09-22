"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, FormAlert } from "@/shared/ui";

export function ConcluirMetaButton({ goalId }: { goalId: string }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    setError(null);
    const response = await fetch(`/api/minhas-metas/${goalId}/concluir`, { method: "POST" });
    setIsSubmitting(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.message ?? "Não foi possível concluir a meta. Tente novamente.");
      return;
    }

    router.refresh();
  }

  return (
    <div>
      {error ? <FormAlert variant="error">{error}</FormAlert> : null}
      <Button type="button" variant="filled" onClick={handleClick} disabled={isSubmitting}>
        {isSubmitting ? "Concluindo…" : "Concluir"}
      </Button>
    </div>
  );
}
