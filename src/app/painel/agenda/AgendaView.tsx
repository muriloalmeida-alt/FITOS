"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, ChipGroup, FormAlert, Sheet, Tag, TextField, useToast, type TagTone } from "@/shared/ui";
import { addDays, dayLabel, formatTime, parseTime, weekdayLabel } from "@/shared/lib/scheduleTime";
import { requestJson } from "../_workout-builder/apiClient";
import styles from "./Agenda.module.css";

export interface AgendaOccurrence {
  ref: string;
  studentId: string;
  studentName: string;
  date: string;
  startMinutes: number;
  durationMinutes: number;
  location: string | null;
  status: "AGENDADA" | "FEITA" | "FALTA" | "DESMARCADA";
  note: string | null;
  extra: boolean;
}

interface Props {
  monday: string;
  today: string;
  occurrences: AgendaOccurrence[];
  students: { id: string; name: string }[];
  slots: { id: string; studentName: string; weekday: number; startMinutes: number; durationMinutes: number; location: string | null }[];
}

const STATUS: Record<AgendaOccurrence["status"], { label: string; tone: TagTone } | null> = {
  AGENDADA: null,
  FEITA: { label: "Feita", tone: "ok" },
  FALTA: { label: "Falta", tone: "error" },
  DESMARCADA: { label: "Desmarcada", tone: "muted" },
};
const WEEK = [1, 2, 3, 4, 5, 6, 0];
const DURATIONS = [30, 45, 60, 90].map((value) => ({ value: String(value), label: `${value} min` }));
const first = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/// Agenda do personal (EPIC-48): a semana, dia a dia, com a situação de
/// cada aula; tocar abre as ações (feita, falta, desmarcar, remarcar).
/// Horários fixos e aulas avulsas pelos botões do topo.
export function AgendaView({ monday, today, occurrences, students, slots }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [sheet, setSheet] = useState<null | "slot" | "extra" | "occurrence" | "reschedule">(null);
  const [current, setCurrent] = useState<AgendaOccurrence | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ studentId: null as string | null, weekdays: [] as string[], time: "07:00", duration: "60", location: "", date: today, note: "" });
  const set = <K extends keyof typeof form>(key: K) => (value: (typeof form)[K]) => setForm((state) => ({ ...state, [key]: value }));
  const days = Array.from({ length: 7 }, (_, index) => addDays(monday, index));

  function open(next: typeof sheet, occurrence: AgendaOccurrence | null = null) {
    setError(null);
    setCurrent(occurrence);
    if (next === "reschedule" && occurrence) setForm((state) => ({ ...state, date: occurrence.date, time: formatTime(occurrence.startMinutes) }));
    if (next === "extra") setForm((state) => ({ ...state, date: today < monday ? monday : today }));
    setSheet(next);
  }

  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
      toast.show(message);
      setSheet(null);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível concluir.");
    } finally {
      setBusy(false);
    }
  }

  const status = (value: AgendaOccurrence["status"], message: string) =>
    run(() => requestJson("/api/agenda/ocorrencia", { method: "PATCH", body: JSON.stringify({ ref: current!.ref, status: value }) }), message);

  const studentOptions = students.map((student) => ({ value: student.id, label: first(student.name) }));

  return (
    <div className={styles.agenda}>
      <nav className={styles.week} aria-label="Semana">
        <Link href={`/painel/agenda?semana=${addDays(monday, -7)}`} aria-label="Semana anterior">
          ‹
        </Link>
        <strong>
          {dayLabel(days[0]!).split(", ")[1]} a {dayLabel(days[6]!).split(", ")[1]}
        </strong>
        <Link href={`/painel/agenda?semana=${addDays(monday, 7)}`} aria-label="Próxima semana">
          ›
        </Link>
      </nav>
      <div className={styles.actions}>
        <Button type="button" onClick={() => open("slot")} disabled={students.length === 0}>
          Horário fixo
        </Button>
        <Button type="button" variant="secondary" onClick={() => open("extra")} disabled={students.length === 0}>
          Aula avulsa
        </Button>
      </div>

      {days.map((date) => {
        const list = occurrences.filter((item) => item.date === date);
        return (
          <section key={date} className={styles.day} aria-label={dayLabel(date)}>
            <h2 className={date === today ? styles.today : undefined}>
              {dayLabel(date)}
              {date === today ? " · hoje" : ""}
            </h2>
            {list.length === 0 ? (
              <p className={styles.free}>Livre</p>
            ) : (
              <ul className={styles.list}>
                {list.map((item) => (
                  <li key={item.ref}>
                    <button type="button" className={item.status === "DESMARCADA" ? `${styles.item} ${styles.off}` : styles.item} onClick={() => open("occurrence", item)}>
                      <span className={styles.time}>{formatTime(item.startMinutes)}</span>
                      <span className={styles.who}>
                        <strong>{item.studentName}</strong>
                        <span className={styles.meta}>{[item.extra ? "Avulsa" : null, item.location, item.note].filter(Boolean).join(" · ") || `${item.durationMinutes} min`}</span>
                      </span>
                      {STATUS[item.status] ? <Tag tone={STATUS[item.status]!.tone}>{STATUS[item.status]!.label}</Tag> : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      {slots.length > 0 ? (
        <section className={styles.day} aria-label="Horários fixos">
          <h2>Horários fixos</h2>
          <ul className={styles.list}>
            {slots.map((slot) => (
              <li key={slot.id} className={styles.slot}>
                <span>
                  <strong>{first(slot.studentName)}</strong> · {weekdayLabel(slot.weekday)} {formatTime(slot.startMinutes)} · {slot.durationMinutes} min{slot.location ? ` · ${slot.location}` : ""}
                </span>
                <Button type="button" variant="quiet" disabled={busy} onClick={() => void run(() => requestJson(`/api/agenda/horarios/${slot.id}`, { method: "DELETE" }), "Horário encerrado")}>
                  Encerrar
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Sheet
        open={sheet === "slot"}
        onClose={() => setSheet(null)}
        title="Horário fixo"
        description="Toda semana, nos dias escolhidos."
        footer={
          <Button
            type="button"
            block
            disabled={busy || !form.studentId || form.weekdays.length === 0 || parseTime(form.time) === null}
            onClick={() => void run(() => requestJson("/api/agenda/horarios", { method: "POST", body: JSON.stringify({ studentId: form.studentId, weekdays: form.weekdays.map(Number), startMinutes: parseTime(form.time), durationMinutes: Number(form.duration), location: form.location }) }), "Horário salvo")}
          >
            Salvar
          </Button>
        }
      >
        <div className={styles.stack}>
          <ChipGroup label="Aluno" showLabel variant="scroll" value={form.studentId} onChange={set("studentId")} options={studentOptions} />
          <ChipGroup label="Dias" showLabel multiple value={form.weekdays} onChange={set("weekdays")} options={WEEK.map((day) => ({ value: String(day), label: weekdayLabel(day, true) }))} />
          <TextField label="Hora" type="time" step={300} value={form.time} onChange={(event) => set("time")(event.target.value)} />
          <ChipGroup label="Duração" showLabel value={form.duration} onChange={set("duration")} options={DURATIONS} />
          <TextField label="Local (opcional)" value={form.location} onChange={(event) => set("location")(event.target.value)} />
          {error ? <FormAlert>{error}</FormAlert> : null}
        </div>
      </Sheet>

      <Sheet
        open={sheet === "extra"}
        onClose={() => setSheet(null)}
        title="Aula avulsa"
        description="Só nesse dia."
        footer={
          <Button
            type="button"
            block
            disabled={busy || !form.studentId || parseTime(form.time) === null}
            onClick={() => void run(() => requestJson("/api/agenda/aulas", { method: "POST", body: JSON.stringify({ studentId: form.studentId, date: form.date, startMinutes: parseTime(form.time), durationMinutes: Number(form.duration), note: form.note }) }), "Aula marcada")}
          >
            Marcar
          </Button>
        }
      >
        <div className={styles.stack}>
          <ChipGroup label="Aluno" showLabel variant="scroll" value={form.studentId} onChange={set("studentId")} options={studentOptions} />
          <div className={styles.row}>
            <TextField label="Dia" type="date" value={form.date} onChange={(event) => set("date")(event.target.value)} />
            <TextField label="Hora" type="time" step={300} value={form.time} onChange={(event) => set("time")(event.target.value)} />
          </div>
          <ChipGroup label="Duração" showLabel value={form.duration} onChange={set("duration")} options={DURATIONS} />
          <TextField label="Observação (opcional)" value={form.note} onChange={(event) => set("note")(event.target.value)} />
          {error ? <FormAlert>{error}</FormAlert> : null}
        </div>
      </Sheet>

      <Sheet open={sheet === "occurrence" && current !== null} onClose={() => setSheet(null)} title={current ? `${first(current.studentName)} · ${formatTime(current.startMinutes)}` : ""} description={current ? `${dayLabel(current.date)}${current.note ? ` · ${current.note}` : ""}` : undefined}>
        {current ? (
          <div className={styles.stack}>
            <div className={styles.row}>
              <Button type="button" disabled={busy || current.status === "FEITA"} onClick={() => void status("FEITA", "Aula feita")}>
                Feita
              </Button>
              <Button type="button" variant="secondary" disabled={busy || current.status === "FALTA"} onClick={() => void status("FALTA", "Falta registrada")}>
                Falta
              </Button>
            </div>
            <Button type="button" variant="secondary" block disabled={busy} onClick={() => open("reschedule", current)}>
              Remarcar
            </Button>
            {current.status !== "DESMARCADA" ? (
              <Button type="button" variant="quiet" block disabled={busy} onClick={() => void status("DESMARCADA", `Aula desmarcada; ${first(current.studentName)} foi avisado`)}>
                Desmarcar
              </Button>
            ) : null}
            {current.status !== "AGENDADA" ? (
              <Button type="button" variant="quiet" block disabled={busy} onClick={() => void status("AGENDADA", "Aula de volta na agenda")}>
                Voltar para agendada
              </Button>
            ) : null}
            <Link href={`/painel/mensagens?aluno=${current.studentId}&nova=1`} className={styles.link}>
              Mandar mensagem →
            </Link>
            {error ? <FormAlert>{error}</FormAlert> : null}
          </div>
        ) : null}
      </Sheet>

      <Sheet
        open={sheet === "reschedule" && current !== null}
        onClose={() => setSheet(null)}
        title="Remarcar"
        description={current ? `${first(current.studentName)} · ${dayLabel(current.date)} às ${formatTime(current.startMinutes)}` : undefined}
        footer={
          <Button type="button" block disabled={busy || parseTime(form.time) === null} onClick={() => void run(() => requestJson("/api/agenda/ocorrencia", { method: "PATCH", body: JSON.stringify({ ref: current!.ref, date: form.date, startMinutes: parseTime(form.time) }) }), "Aula remarcada")}>
            Remarcar
          </Button>
        }
      >
        <div className={styles.row}>
          <TextField label="Novo dia" type="date" value={form.date} onChange={(event) => set("date")(event.target.value)} />
          <TextField label="Hora" type="time" step={300} value={form.time} onChange={(event) => set("time")(event.target.value)} />
        </div>
        {error ? <FormAlert>{error}</FormAlert> : null}
      </Sheet>
    </div>
  );
}
