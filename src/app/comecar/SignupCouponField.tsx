"use client";

import { useState } from "react";
import { Button, TextField } from "@/shared/ui";
import styles from "../_entrada/Entrada.module.css";

export interface SignupCoupon {
  code: string;
  summary: string;
}

/// "Tem um cupom de desconto?" no cadastro: confere o código antes de
/// criar a conta e mostra o desconto. O cupom conferido vai junto com o
/// cadastro e fica na conta para as próximas cobranças. `onPendingChange`:
/// há código digitado ainda não conferido.
export function SignupCouponField({ product, value, onChange, onPendingChange, disabled = false }: { product: "INDIVIDUAL" | "PERSONAL"; value: SignupCoupon | null; onChange: (coupon: SignupCoupon | null) => void; onPendingChange?: (pending: boolean) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function type(next: string) {
    setCode(next.toUpperCase());
    setError(null);
    onPendingChange?.(next.trim() !== "");
  }

  async function apply() {
    if (!code.trim() || busy) return;
    setBusy(true);
    setError(null);
    const response = await fetch("/api/cupons/verificar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, product }) }).catch(() => null);
    const body = (await response?.json().catch(() => null)) as { code?: string; summary?: string; message?: string } | null;
    setBusy(false);
    if (!response?.ok || !body?.code || !body.summary) {
      setError(body?.message ?? "Não foi possível conferir o cupom. Tente de novo.");
      return;
    }
    onChange({ code: body.code, summary: body.summary });
    onPendingChange?.(false);
  }

  function remove() {
    onChange(null);
    setCode("");
    setOpen(false);
    onPendingChange?.(false);
  }

  if (value) {
    return (
      <div className={styles.invite} role="status">
        <strong>Cupom {value.code} aplicado:</strong> {value.summary}{" "}
        <button type="button" className={styles.linkButton} onClick={remove} disabled={disabled}>
          Remover
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" className={styles.linkButton} onClick={() => setOpen(true)} disabled={disabled}>
        Tem um cupom de desconto?
      </button>
    );
  }

  return (
    <div className={styles.couponRow}>
      <TextField label="Cupom de desconto" name="coupon" autoCapitalize="characters" autoComplete="off" value={code} onChange={(event) => type(event.target.value)} error={error ?? undefined} disabled={disabled || busy} />
      <Button type="button" variant="secondary" onClick={() => void apply()} disabled={disabled || busy || !code.trim()}>
        {busy ? "Conferindo…" : "Aplicar"}
      </Button>
      {error ? null : <span className={styles.muted}>O desconto fica na sua conta e vale nas próximas cobranças.</span>}
    </div>
  );
}

/// Aviso quando o cupom não pôde ser aplicado na conta nova.
export function couponNotice(coupon: { applied: boolean; message?: string } | null | undefined): string | null {
  if (!coupon || coupon.applied) return null;
  return `Sua conta foi criada, mas o cupom não foi aplicado: ${coupon.message ?? "tente de novo em Assinatura."}`;
}

