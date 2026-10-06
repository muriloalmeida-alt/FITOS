"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, FormAlert, Sheet, Tag, TextField, useToast } from "@/shared/ui";
import { dayLabel, formatTime } from "@/shared/lib/scheduleTime";
import { requestJson } from "../_workout-builder/apiClient";
import type { AgendaOccurrence } from "./AgendaView";
import styles from "./Agenda.module.css";

/// Próximas aulas do aluno (EPIC-48), com "Não vou" (avisa o personal).
export function StudentAgenda({ occurrences, coachName }: { occurrences: AgendaOccurrence[]; coachName: string }) {
  const router = useRouter();
  const toast = useToast();
  const [current, setCurrent] = useState<AgendaOccurrence | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const coach = coachName.trim().split(/\s+/)[0] ?? coachName;

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      await requestJson("/api/agenda/nao-vou", { method: "POST", body: JSON.stringify({ ref: current!.ref, reason }) });
      toast.show(`${coach} foi avisado`);
      setCurrent(null);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível avisar.");
    } finally {
      setBusy(false);
    }
  }

  if (occurrences.length === 0) return <p className={styles.free}>Nenhuma aula marcada nas próximas duas semanas. Os horários são combinados com {coach}.</p>;

  return (
    <div className={styles.agenda}>
      <ul className={styles.list}>
        {occurrences.map((item) => (
          <li key={item.ref}>
            <div className={item.status === "DESMARCADA" ? `${styles.item} ${styles.off}` : styles.item}>
              <span className={styles.time}>{formatTime(item.startMinutes)}</span>
              <span className={styles.who}>
                <strong>{dayLabel(item.date)}</strong>
                <span className={styles.meta}>{[item.location, item.note].filter(Boolean).join(" · ") || `${item.durationMinutes} min com ${coach}`}</span>
              </span>
              {item.status === "DESMARCADA" ? (
                <Tag tone="muted">Desmarcada</Tag>
              ) : item.status === "AGENDADA" ? (
                <Button
                  type="button"
                  variant="quiet"
                  onClick={() => {
                    setReason("");
                    setError(null);
                    setCurrent(item);
                  }}
                >
                  Não vou
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <Sheet
        open={current !== null}
        onClose={() => setCurrent(null)}
        title="Avisar que não vai"
        description={current ? `${dayLabel(current.date)} às ${formatTime(current.startMinutes)}. ${coach} recebe o aviso na hora.` : undefined}
        footer={
          <Button type="button" block disabled={busy} onClick={() => void cancel()}>
            {busy ? "Avisando…" : `Avisar ${coach}`}
          </Button>
        }
      >
        <TextField label="Motivo (opcional)" value={reason} onChange={(event) => setReason(event.target.value)} />
        {error ? <FormAlert>{error}</FormAlert> : null}
      </Sheet>
    </div>
  );
}
