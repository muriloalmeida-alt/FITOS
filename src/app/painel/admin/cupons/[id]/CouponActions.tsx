"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, FormAlert } from "@/shared/ui";

const ACTIONS: Record<string, { action: string; label: string; variant?: "secondary" | "quiet" }[]> = {
  DRAFT: [
    { action: "ATIVAR", label: "Ativar campanha" },
    { action: "ARQUIVAR", label: "Arquivar", variant: "quiet" },
  ],
  ACTIVE: [
    { action: "PAUSAR", label: "Pausar novos resgates", variant: "secondary" },
    { action: "ENCERRAR", label: "Encerrar campanha", variant: "quiet" },
  ],
  PAUSED: [
    { action: "RETOMAR", label: "Retomar" },
    { action: "ENCERRAR", label: "Encerrar campanha", variant: "quiet" },
  ],
  ENDED: [{ action: "ARQUIVAR", label: "Arquivar", variant: "quiet" }],
  ARCHIVED: [],
};

/// Ações de estado da campanha. Ativar refaz a prévia no servidor.
export function CouponActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: string) {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/admin/cupons/${id}/estado`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) }).catch(() => null);
    const body = await response?.json().catch(() => null);
    setBusy(false);
    if (!response?.ok) return setError(body?.message ?? "Não foi possível mudar o estado.");
    router.refresh();
  }

  return (
    <>
      {ACTIONS[status]?.map((item) => (
        <Button key={item.action} type="button" variant={item.variant} block disabled={busy} onClick={() => void run(item.action)}>
          {item.label}
        </Button>
      ))}
      {error ? <FormAlert variant="error">{error}</FormAlert> : null}
    </>
  );
}
