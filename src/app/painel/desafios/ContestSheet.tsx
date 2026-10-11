"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, FormAlert, Sheet } from "@/shared/ui";
import { formatPoints } from "@/shared/lib/scoring";
import styles from "./Contests.module.css";

export interface WorkoutForContest {
  scoreId: string;
  performedAtIso: string;
  pointsTenths: number;
  status: string;
  contestable: boolean;
}

const dateFmt = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

const STATUS_LABEL: Record<string, string> = { CONTESTADO: "em contestação", MANTIDO: "mantido após análise", ANULADO: "anulado" };

/// Treinos de um colega pelo resumo mínimo (data e pontos) e "Contestar"
/// com o motivo. Os pontos continuam valendo até a decisão.
export function ContestSheet({ open, onClose, name, workouts, target }: { open: boolean; onClose: () => void; name: string; workouts: WorkoutForContest[]; target: { context: "AMIGOS"; groupId: string } | { context: "TURMA" } }) {
  const router = useRouter();
  const [chosen, setChosen] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function send() {
    if (!chosen) return;
    setBusy(true);
    setError(null);
    const response = await fetch("/api/desafios/contestacoes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...target, scoreId: chosen, reason }) }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      setError((await response?.json().catch(() => null))?.message ?? "Não foi possível enviar. Tente de novo.");
      return;
    }
    setSent(true);
    setChosen(null);
    setReason("");
    router.refresh();
  }

  return (
    <Sheet open={open} onClose={onClose} title={`Treinos de ${name}`}>
      <div className={styles.sheet}>
        {sent ? <FormAlert variant="info">Contestação enviada. Os pontos seguem valendo até a análise.</FormAlert> : null}
        {workouts.length === 0 ? <p className={styles.muted}>Nenhum treino com pontos nesta temporada.</p> : null}
        <ul className={styles.workouts}>
          {workouts.map((workout) => (
            <li key={workout.scoreId}>
              <span>
                <strong>{formatPoints(workout.pointsTenths)} pontos</strong>
                <span className={styles.muted}>
                  {dateFmt.format(new Date(workout.performedAtIso))}
                  {STATUS_LABEL[workout.status] ? ` · ${STATUS_LABEL[workout.status]}` : ""}
                </span>
              </span>
              {workout.contestable ? (
                <Button type="button" variant={chosen === workout.scoreId ? "filled" : "secondary"} onClick={() => setChosen(chosen === workout.scoreId ? null : workout.scoreId)}>
                  Contestar
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
        {chosen ? (
          <>
            <label className={styles.field}>
              <span>Motivo</span>
              <textarea value={reason} maxLength={500} rows={3} onChange={(event) => setReason(event.target.value)} placeholder="O que parece errado neste treino?" />
            </label>
            {error ? <FormAlert variant="error">{error}</FormAlert> : null}
            <Button type="button" block disabled={busy || reason.trim().length < 5} onClick={() => void send()}>
              {busy ? "Enviando…" : "Enviar contestação"}
            </Button>
          </>
        ) : null}
        <p className={styles.muted}>Dá para contestar até 24 h depois de os pontos serem liberados. Quem treinou não fica sabendo quem contestou.</p>
      </div>
    </Sheet>
  );
}
