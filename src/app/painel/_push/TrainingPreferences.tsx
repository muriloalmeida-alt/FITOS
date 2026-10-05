"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormAlert, useToast } from "@/shared/ui";
import { WEEKDAYS } from "@/shared/lib/weekdays";
import { PUSH_HINT, usePush } from "./usePush";
import styles from "./TrainingPreferences.module.css";

const HOURS = [6, 7, 8, 12, 17, 18, 19, 20];

interface Props {
  reminderHour: number | null;
  /// "Meus dias" escolhidos; vazio = os dias do programa.
  days: string[];
  planDays: string[];
  /// Aluno com personal: avisa que o personal recebe a mudança.
  coachFirst: string | null;
}

function dayNames(days: string[]) {
  const names = WEEKDAYS.filter((day) => days.includes(day.key)).map((day) => day.short.toLowerCase());
  return names.length > 0 ? names.join(", ") : "nenhum dia";
}

/// Lembrete de treino e "Meus dias" editados no lugar (EPIC-31, como no
/// protótipo): toca na linha, escolhe, salva na hora.
export function TrainingPreferences({ reminderHour, days, planDays, coachFirst }: Props) {
  const router = useRouter();
  const toast = useToast();
  const push = usePush();
  const [open, setOpen] = useState<null | "lembrete" | "dias">(null);
  const [hour, setHour] = useState(reminderHour);
  const [mine, setMine] = useState(days.length > 0 ? days : planDays);
  const [error, setError] = useState<string | null>(null);

  async function saveHour(next: number | null) {
    setError(null);
    if (next !== null && push.state !== "on") {
      const hint = PUSH_HINT[push.state];
      if (hint) return setError(hint);
      let ok: boolean;
      try {
        ok = await push.enable();
      } catch {
        return setError("Não foi possível ligar as notificações neste aparelho. Tente de novo em instantes.");
      }
      if (!ok) return setError("Sem permissão para notificar, o lembrete não chega. Libere as notificações e tente de novo.");
    }
    const previous = hour;
    setHour(next);
    const response = await fetch("/api/minhas-notificacoes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reminderHour: next }) }).catch(() => null);
    if (!response?.ok) {
      setHour(previous);
      return setError("Não foi possível salvar. Tente de novo.");
    }
    toast.show(next === null ? "Lembrete desligado" : `Lembrete às ${next}h nos dias de treino`);
  }

  async function toggleDay(key: string) {
    setError(null);
    const previous = mine;
    const next = mine.includes(key) ? mine.filter((day) => day !== key) : [...mine, key];
    setMine(next);
    const response = await fetch("/api/meus-dias", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ days: next }) }).catch(() => null);
    if (!response?.ok) {
      setMine(previous);
      return setError("Não foi possível salvar. Tente de novo.");
    }
    toast.show("Salvo");
    router.refresh();
  }

  return (
    <div className={styles.group}>
      <button type="button" className={open === "lembrete" ? `${styles.fact} ${styles.open}` : styles.fact} aria-expanded={open === "lembrete"} onClick={() => setOpen(open === "lembrete" ? null : "lembrete")}>
        <span>
          <span className={styles.label}>Lembrete de treino</span>
          <span className={styles.value}>{hour === null ? "Desligado" : `Nos dias de treino, às ${hour}h`}</span>
        </span>
        <span className={styles.pencil} aria-hidden="true">✎</span>
      </button>
      {open === "lembrete" ? (
        <div className={styles.inline} role="radiogroup" aria-label="Hora do lembrete">
          {[...HOURS, null].map((value) => (
            <button key={String(value)} type="button" role="radio" aria-checked={hour === value} className={hour === value ? `${styles.chip} ${styles.chipOn}` : styles.chip} onClick={() => void saveHour(value)}>
              {value === null ? "Desligado" : `${value}h`}
            </button>
          ))}
        </div>
      ) : null}

      <button type="button" className={open === "dias" ? `${styles.fact} ${styles.open}` : styles.fact} aria-expanded={open === "dias"} onClick={() => setOpen(open === "dias" ? null : "dias")}>
        <span>
          <span className={styles.label}>Meus dias</span>
          <span className={styles.value}>{dayNames(mine)}</span>
        </span>
        <span className={styles.pencil} aria-hidden="true">✎</span>
      </button>
      {open === "dias" ? (
        <div className={styles.inlineCol}>
          <div className={styles.days} role="group" aria-label="Meus dias">
            {WEEKDAYS.map((day) => (
              <button key={day.key} type="button" aria-pressed={mine.includes(day.key)} aria-label={day.name} className={mine.includes(day.key) ? `${styles.day} ${styles.dayOn}` : styles.day} onClick={() => void toggleDay(day.key)}>
                {day.letter}
              </button>
            ))}
          </div>
          {coachFirst ? <p className={styles.note}>{coachFirst} é avisado se você mudar.</p> : null}
        </div>
      ) : null}
      {error ? <FormAlert>{error}</FormAlert> : null}
    </div>
  );
}
