"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, FormAlert } from "@/shared/ui";

export function InativarAlunoButton({ studentId }: { studentId: string }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    setError(null);
    const response = await fetch(`/api/students/${studentId}/inativar`, { method: "POST" });
    setIsSubmitting(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.message ?? "Não foi possível inativar o aluno. Tente novamente.");
      return;
    }

    router.push(`/painel/alunos/${studentId}`);
    router.refresh();
  }

  return (
    <>
      {error ? <FormAlert variant="error">{error}</FormAlert> : null}
      <Button type="button" variant="filled" onClick={handleClick} disabled={isSubmitting}>
        {isSubmitting ? "Inativando…" : "Confirmar inativação"}
      </Button>
    </>
  );
}
