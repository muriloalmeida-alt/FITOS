"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Tag, useToast, type TagTone } from "@/shared/ui";
import { formatTime } from "@/shared/lib/scheduleTime";
import { requestJson } from "./_workout-builder/apiClient";
import styles from "./PersonalHome.module.css";

export interface TodayClass {
  ref: string;
  studentName: string;
  startMinutes: number;
  durationMinutes: number;
  location: string | null;
  note: string | null;
  extra: boolean;
  status: "AGENDADA" | "FEITA" | "FALTA" | "DESMARCADA";
}

const STATUS: Record<TodayClass["status"], { label: string; tone: TagTone } | null> = {
  AGENDADA: null,
  FEITA: { label: "Feita", tone: "ok" },
  FALTA: { label: "Falta", tone: "error" },
  DESMARCADA: { label: "Desmarcada", tone: "muted" },
};

/// Agenda de hoje no Início do personal (EPIC-48): as aulas do dia em
/// ordem, a próxima destacada e, nas que já começaram, "Feita" e "Falta"
/// sem sair do Início.
export function TodayAgenda({ classes, nowMinutes }: { classes: TodayClass[]; nowMinutes: number }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const next = classes.find((item) => item.status === "AGENDADA" && item.startMinutes + item.durationMinutes > nowMinutes) ?? null;

  async function mark(item: TodayClass, status: "FEITA" | "FALTA") {
    setBusy(item.ref);
    try {
      await requestJson("/api/agenda/ocorrencia", { method: "PATCH", body: JSON.stringify({ ref: item.ref, status }) });
      toast.show(status === "FEITA" ? "Aula feita" : "Falta registrada");
      router.refresh();
    } catch (cause) {
      toast.show(cause instanceof Error ? cause.message : "Não foi possível marcar.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className={styles.section} aria-labelledby="agenda-hoje">
      <div className={styles.sectionHead}>
        <h2 id="agenda-hoje" className={styles.sectionTitle}>
          Agenda de hoje
        </h2>
        <Link href="/painel/agenda" className={styles.sectionLink}>
          Ver semana →
        </Link>
      </div>
      {classes.length === 0 ? (
        <p className={styles.empty}>
          Nenhuma aula hoje.{" "}
          <Link href="/painel/agenda" className={styles.sectionLink}>
            Marcar horário
          </Link>
        </p>
      ) : (
        <ul className={styles.agenda}>
          {classes.map((item) => {
            const started = item.startMinutes <= nowMinutes;
            const tag = STATUS[item.status];
            return (
              <li key={item.ref} className={item.status === "DESMARCADA" ? `${styles.agendaItem} ${styles.agendaOff}` : styles.agendaItem}>
                <span className={styles.agendaTime}>{formatTime(item.startMinutes)}</span>
                <span className={styles.agendaWho}>
                  <strong>{item.studentName}</strong>
                  <span className={styles.agendaMeta}>{[item.extra ? "Avulsa" : null, item.location, item.note].filter(Boolean).join(" · ") || `${item.durationMinutes} min`}</span>
                </span>
                {item.status === "FEITA" || item.status === "FALTA" ? (
                  <span className={`${styles.checkButton} ${styles.checkMark} ${item.status === "FEITA" ? styles.checkDoneOn : styles.checkMissedOn}`} role="img" aria-label={item.status === "FEITA" ? "Feita" : "Falta"} title={item.status === "FEITA" ? "Feita" : "Falta"}>
                    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d={item.status === "FEITA" ? "M5 12.5l4.5 4.5L19 7.5" : "M7 7l10 10M17 7L7 17"} />
                    </svg>
                  </span>
                ) : tag ? (
                  <Tag tone={tag.tone}>{tag.label}</Tag>
                ) : started ? (
                  <span className={styles.agendaActions}>
                    <button type="button" className={`${styles.checkButton} ${styles.checkDone}`} aria-label="Feita" title="Feita" disabled={busy !== null} onClick={() => void mark(item, "FEITA")}>
                      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12.5l4.5 4.5L19 7.5" />
                      </svg>
                    </button>
                    <button type="button" className={`${styles.checkButton} ${styles.checkMissed}`} aria-label="Falta" title="Falta" disabled={busy !== null} onClick={() => void mark(item, "FALTA")}>
                      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                        <path d="M7 7l10 10M17 7L7 17" />
                      </svg>
                    </button>
                  </span>
                ) : item === next ? (
                  <Tag tone="warn">Próxima</Tag>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
