"use client";

import { useEffect, useRef, useState } from "react";
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

/// Altura de uma hora na linha do tempo: quatro horas cabem na janela.
const HOUR_PX = 56;
const VISIBLE_HOURS = 4;
const DAY_START = 5;
const DAY_END = 23;

function hourLabel(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

/// Agenda de hoje no Início do personal (EPIC-48): o dia na vertical, com
/// quatro horas à vista e rolagem só dentro da agenda, já posicionada
/// perto da hora atual. Nas aulas que já começaram, "Feita" e "Falta" sem
/// sair do Início. Sem aulas, o cartão inteiro abre a agenda para marcar.
export function TodayAgenda({ classes, nowMinutes }: { classes: TodayClass[]; nowMinutes: number }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const next = classes.find((item) => item.status === "AGENDADA" && item.startMinutes + item.durationMinutes > nowMinutes) ?? null;

  const sorted = [...classes].sort((a, b) => a.startMinutes - b.startMinutes);
  const firstHour = Math.min(DAY_START, ...sorted.map((item) => Math.floor(item.startMinutes / 60)));
  const lastHour = Math.max(DAY_END, ...sorted.map((item) => Math.ceil((item.startMinutes + item.durationMinutes) / 60)));
  const hours = Array.from({ length: Math.min(24, lastHour) - firstHour }, (_, index) => firstHour + index);
  const offset = (minutes: number) => ((minutes - firstHour * 60) / 60) * HOUR_PX;
  const nowVisible = nowMinutes >= firstHour * 60 && nowMinutes <= lastHour * 60;

  // Foco perto da hora atual: meia hora antes dela no topo da janela.
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    element.scrollTop = Math.max(0, offset(nowMinutes) - HOUR_PX / 2);
    // Só ao abrir: a rolagem depois é do personal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const grid = (
    <>
      {hours.map((hour) => (
        <span key={hour} className={styles.timelineHour} style={{ top: offset(hour * 60) }} aria-hidden="true">
          {hourLabel(hour)}
        </span>
      ))}
      {nowVisible ? <span className={styles.timelineNow} style={{ top: offset(nowMinutes) }} aria-hidden="true" /> : null}
    </>
  );
  const frame = { height: VISIBLE_HOURS * HOUR_PX };
  const inner = { height: hours.length * HOUR_PX };

  // Sem aula hoje: só o cartão da agenda, que inteiro leva a marcar aulas.
  if (sorted.length === 0) {
    return (
      <Link href="/painel/agenda" className={`${styles.agendaCard} ${styles.agendaCardLink}`} aria-label="Agenda de hoje, sem aulas. Abrir a agenda para marcar">
        <span className={styles.agendaCardTitle}>Agenda de hoje</span>
        <div ref={scroller} className={`${styles.timeline} ${styles.timelineStill}`} style={frame}>
          <div className={styles.timelineInner} style={inner}>
            {grid}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <section className={styles.agendaCard} aria-labelledby="agenda-hoje">
      <div className={styles.sectionHead}>
        <h2 id="agenda-hoje" className={styles.agendaCardTitle}>
          Agenda de hoje
        </h2>
        <Link href="/painel/agenda" className={styles.sectionLink}>
          Ver semana →
        </Link>
      </div>
      <div ref={scroller} className={styles.timeline} style={frame} tabIndex={0} aria-label="Aulas de hoje, por horário">
        <div className={styles.timelineInner} style={inner}>
          {grid}
          <ul className={styles.agenda}>
            {sorted.map((item, index) => {
              const started = item.startMinutes <= nowMinutes;
              const tag = STATUS[item.status];
              const following = sorted[index + 1];
              const top = offset(item.startMinutes) + 2;
              // Aula curta seguida de outra: o bloco não invade a próxima.
              const room = following ? offset(following.startMinutes) - top - 2 : Infinity;
              const height = Math.max(24, Math.min(Math.max((item.durationMinutes / 60) * HOUR_PX - 4, 48), room));
              const classNames = [styles.agendaItem, height < 44 ? styles.agendaTight : "", item.status === "DESMARCADA" ? styles.agendaOff : "", item === next ? styles.agendaNext : ""].filter(Boolean).join(" ");
              return (
                <li key={item.ref} className={classNames} style={{ top, height }}>
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
        </div>
      </div>
    </section>
  );
}
