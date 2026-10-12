"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, FormAlert, useToast } from "@/shared/ui";
import { WEEKDAYS } from "@/shared/lib/weekdays";
import { PUSH_HINT, usePush } from "../_push/usePush";
import { InstallGuide } from "../_push/InstallGuide";
import { SheetRow } from "./ProfileParts";
import styles from "./ProfileParts.module.css";

const HOURS = [6, 7, 8, 12, 17, 18, 19, 20];

export interface RoutinePreferences {
  reminderHour: number | null;
  /// "Meus dias" escolhidos; vazio = os dias do programa.
  days: string[];
  planDays: string[];
  /// Aluno com personal: avisa que o personal recebe a mudança.
  coachFirst: string | null;
}

/// "Terça, quarta e sábado"; "Nenhum dia escolhido" quando vazio.
export function daySentence(days: readonly string[]): string {
  const names = WEEKDAYS.filter((day) => days.includes(day.key)).map((day) => day.name.toLowerCase());
  if (names.length === 0) return "Nenhum dia escolhido";
  const text = names.length === 1 ? names[0]! : `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
  return text[0]!.toUpperCase() + text.slice(1);
}

export function reminderSentence(hour: number | null): string {
  return hour === null ? "Desativado" : `Nos dias de treino, às ${hour}h`;
}

/// Dias de treino e Lembrete (EPIC-31) como linhas do Perfil: o resumo na
/// linha, a escolha numa modal. Cada toque salva na hora, como antes; erro
/// volta ao valor anterior.
export function RoutineRows({ reminderHour, days, planDays, coachFirst }: RoutinePreferences) {
  const router = useRouter();
  const toast = useToast();
  const push = usePush();
  const [hour, setHour] = useState(reminderHour);
  const [mine, setMine] = useState(days.length > 0 ? days : planDays);
  const [error, setError] = useState<string | null>(null);
  const [guide, setGuide] = useState(false);

  async function saveHour(next: number | null) {
    setError(null);
    if (next !== null && push.state !== "on") {
      if (push.state === "install") return setGuide(true);
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
    toast.show(next === null ? "Lembrete desativado" : `Lembrete às ${next}h nos dias de treino`);
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
    toast.show("Dias salvos");
    router.refresh();
  }

  const done = (close: () => void) => (
    <Button type="button" block onClick={close}>
      Pronto
    </Button>
  );

  return (
    <>
      <SheetRow icon="dias" title="Dias de treino" summary={daySentence(mine)} footer={done}>
        <div className={styles.form}>
          <div className={styles.days} role="group" aria-label="Dias de treino">
            {WEEKDAYS.map((day) => (
              <button key={day.key} type="button" aria-pressed={mine.includes(day.key)} aria-label={day.name} className={mine.includes(day.key) ? `${styles.day} ${styles.dayOn}` : styles.day} onClick={() => void toggleDay(day.key)}>
                {day.short}
              </button>
            ))}
          </div>
          {coachFirst ? <p className={styles.note}>{coachFirst} é avisado se você mudar.</p> : null}
          {error ? <FormAlert>{error}</FormAlert> : null}
        </div>
      </SheetRow>
      <SheetRow icon="lembrete" title="Lembrete de treino" summary={reminderSentence(hour)} footer={done}>
        <div className={styles.form}>
          <div className={styles.hours} role="radiogroup" aria-label="Hora do lembrete">
            {[...HOURS, null].map((value) => (
              <button key={String(value)} type="button" role="radio" aria-checked={hour === value} className={hour === value ? `${styles.chip} ${styles.chipOn}` : styles.chip} onClick={() => void saveHour(value)}>
                {value === null ? "Desativado" : `${value}h`}
              </button>
            ))}
          </div>
          {error ? <FormAlert>{error}</FormAlert> : null}
        </div>
      </SheetRow>
      {/* Depois das modais: abre por cima da modal do lembrete. */}
      <InstallGuide open={guide} onClose={() => setGuide(false)} />
    </>
  );
}
