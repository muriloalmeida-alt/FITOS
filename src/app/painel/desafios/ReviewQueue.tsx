"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, FormAlert } from "@/shared/ui";
import { formatPoints } from "@/shared/lib/scoring";
import styles from "./Contests.module.css";

export interface ReviewCaseView {
  id: string;
  where: string;
  isAppeal: boolean;
  ownerName: string;
  performedAtIso: string;
  pointsTenths: number;
  reason: string;
  openedAtIso: string;
  evidenceIds: string[];
}

const dateFmt = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

function ReviewItem({ item }: { item: ReviewCaseView }) {
  const router = useRouter();
  const [decision, setDecision] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(outcome: "MANTIDO" | "ANULADO") {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/desafios/contestacoes/${item.id}/decisao`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcome, decision }) }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      setError((await response?.json().catch(() => null))?.message ?? "Não foi possível registrar. Tente de novo.");
      return;
    }
    router.refresh();
  }

  return (
    <li className={styles.case}>
      <p className={styles.muted}>
        {item.where}
        {item.isAppeal ? " · recurso" : ""} · aberto em {dateFmt.format(new Date(item.openedAtIso))}
      </p>
      <strong>
        {item.ownerName} · {formatPoints(item.pointsTenths)} pontos
      </strong>
      <span className={styles.muted}>Treino de {dateFmt.format(new Date(item.performedAtIso))}</span>
      <blockquote className={styles.reason}>{item.reason}</blockquote>
      {item.evidenceIds.length > 0 ? (
        <div className={styles.photos}>
          {item.evidenceIds.map((id, index) => (
            // eslint-disable-next-line @next/next/no-img-element -- foto privada servida pela rota autenticada
            <img key={id} src={`/api/evidencias-treino/${id}`} alt={`Foto ${index + 1} do treino contestado`} />
          ))}
        </div>
      ) : (
        <p className={styles.muted}>O treino está sem foto agora.</p>
      )}
      <label className={styles.field}>
        <span>Justificativa</span>
        <textarea value={decision} maxLength={500} rows={2} onChange={(event) => setDecision(event.target.value)} placeholder="Por que manter ou anular?" />
      </label>
      {error ? <FormAlert variant="error">{error}</FormAlert> : null}
      <div className={styles.decide}>
        <Button type="button" variant="secondary" disabled={busy || decision.trim().length < 5} onClick={() => void decide("MANTIDO")}>
          Manter pontos
        </Button>
        <Button type="button" variant="danger" disabled={busy || decision.trim().length < 5} onClick={() => void decide("ANULADO")}>
          Anular pontos
        </Button>
      </div>
    </li>
  );
}

/// Casos para analisar: resumo, motivo, foto e a decisão com justificativa.
/// Caso aberto não se encerra sozinho; o placar segue provisório até lá.
export function ReviewQueue({ cases }: { cases: ReviewCaseView[] }) {
  if (cases.length === 0) return null;
  return (
    <section className={styles.queue} aria-label="Contestações para analisar">
      <h2 className={styles.title}>Contestações para analisar ({cases.length})</h2>
      <ul className={styles.cases}>
        {cases.map((item) => (
          <ReviewItem key={item.id} item={item} />
        ))}
      </ul>
    </section>
  );
}
