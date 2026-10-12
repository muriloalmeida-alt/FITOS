"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, FormAlert, Tag, TextField } from "@/shared/ui";
import { formatCents } from "@/shared/lib/coupons";
import styles from "./CouponPanel.module.css";

export interface CouponPanelItem {
  id: string;
  code: string;
  summary: string;
  state: "EM_VIGOR" | "ENCERRADO";
  durationCycles: number;
  cyclesUsed: number;
}

interface Quote {
  code: string;
  summary: string;
  planName: string;
  baseCents: number;
  finalCents: number;
  durationCycles: number;
  combinedWith: string[];
  revision: string;
}

/// "Tem um cupom?" (feature 5): consulta o código (sem consumir), mostra o
/// preço com desconto e as condições, e só resgata no "Confirmar". O
/// desconto entra nas próximas cobranças ainda não emitidas; nada aqui
/// afirma que uma cobrança já foi alterada.
export function CouponPanel({ coupons, canRedeem }: { coupons: CouponPanelItem[]; canRedeem: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const operationKey = useRef<string>(crypto.randomUUID());

  async function check() {
    setBusy(true);
    setError(null);
    setQuote(null);
    const response = await fetch("/api/meus-cupons/previa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) }).catch(() => null);
    const body = await response?.json().catch(() => null);
    setBusy(false);
    if (!response?.ok) return setError(body?.message ?? "Não foi possível conferir o cupom. Tente de novo.");
    setQuote(body as Quote);
  }

  async function confirm() {
    if (!quote) return;
    setBusy(true);
    setError(null);
    const response = await fetch("/api/meus-cupons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: quote.code, operationKey: operationKey.current, revision: quote.revision }) }).catch(() => null);
    const body = await response?.json().catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      // Prévia desatualizada: mostra o preço novo antes de pedir de novo.
      if (body?.error === "QUOTE_STALE") void check();
      return setError(body?.message ?? "Não foi possível usar o cupom. Tente de novo.");
    }
    operationKey.current = crypto.randomUUID();
    setOpen(false);
    setQuote(null);
    setCode("");
    router.refresh();
  }

  return (
    <section className={styles.panel} aria-labelledby="cupons">
      <h2 id="cupons" className={styles.title}>
        Cupons
      </h2>
      {coupons.map((coupon) => (
        <div key={coupon.id} className={styles.coupon}>
          <div className={styles.row}>
            <strong>{coupon.code}</strong>
            <Tag tone={coupon.state === "EM_VIGOR" ? "ok" : "muted"}>{coupon.state === "EM_VIGOR" ? "Em vigor" : "Encerrado"}</Tag>
          </div>
          <span>{coupon.summary}</span>
          <span className={styles.muted}>
            {coupon.cyclesUsed} de {coupon.durationCycles} {coupon.durationCycles === 1 ? "cobrança" : "cobranças"} com desconto
          </span>
        </div>
      ))}
      {coupons.some((coupon) => coupon.state === "EM_VIGOR") ? <p className={styles.muted}>O desconto entra nas próximas cobranças ainda não emitidas. Cobrança já emitida ou paga não muda.</p> : null}

      {!canRedeem ? null : !open ? (
        <button type="button" className={styles.link} onClick={() => setOpen(true)}>
          Tem um cupom?
        </button>
      ) : (
        <div className={styles.form}>
          <TextField label="Código do cupom" name="coupon" value={code} autoCapitalize="characters" onChange={(event) => setCode(event.target.value.toUpperCase())} />
          {quote ? (
            <div className={styles.quote} aria-live="polite">
              <strong>{quote.summary}</strong>
              <span>
                {quote.planName}: <s>{formatCents(quote.baseCents)}</s> <strong>{formatCents(quote.finalCents)}</strong> por {quote.durationCycles === 1 ? "1 cobrança" : `${quote.durationCycles} cobranças`}
                {quote.combinedWith.length ? `, junto com ${quote.combinedWith.join(" e ")}` : ""}.
              </span>
              <span className={styles.muted}>Depois, {formatCents(quote.baseCents)}. Período grátis não conta como cobrança.</span>
              <Button type="button" block disabled={busy} onClick={() => void confirm()}>
                {busy ? "Confirmando…" : "Confirmar cupom"}
              </Button>
            </div>
          ) : (
            <Button type="button" block disabled={busy || code.trim().length < 3} onClick={() => void check()}>
              {busy ? "Conferindo…" : "Aplicar"}
            </Button>
          )}
          {error ? <FormAlert variant="error">{error}</FormAlert> : null}
        </div>
      )}
    </section>
  );
}
