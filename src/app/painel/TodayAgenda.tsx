"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Tag, useToast, type TagTone } from "@/shared/ui";
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
                {tag ? (
                  <Tag tone={tag.tone}>{tag.label}</Tag>
                ) : started ? (
                  <span className={styles.agendaActions}>
                    <Button type="button" variant="quiet" disabled={busy !== null} onClick={() => void mark(item, "FEITA")}>
                      Feita
                    </Button>
                    <Button type="button" variant="quiet" disabled={busy !== null} onClick={() => void mark(item, "FALTA")}>
                      Falta
                    </Button>
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
