"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, CardioIcon, ExerciseThumbnail, FormAlert, Sheet, Stepper, useToast } from "@/shared/ui";
import { CARDIO_INTENSITY_LABELS, CARDIO_MAX_SECONDS, CARDIO_MIN_SECONDS, CARDIO_STEP_SECONDS, nextIntensity, type CardioIntensity } from "@/shared/lib/cardio";
import { WEEKDAYS } from "@/shared/lib/weekdays";
import type { CopyItem, StudentCopy } from "@/modules/library/studentCopy";
import styles from "./CopyEditor.module.css";

interface SwapOption {
  id: string;
  name: string;
  muscle: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
}

type Pending = { sets?: number; reps?: number; durationSeconds?: number };

interface Props {
  studentId: string;
  studentFirstName: string;
  copy: StudentCopy;
  cardioOptions: { id: string; name: string }[];
}

const FLUSH_MS = 700;

/// Cópia do aluno (EPIC-28, ADR-016): ajustar só para este aluno. Tocar no
/// exercício troca por outro do mesmo grupo muscular; números com + e −,
/// enviados juntos após uma pausa curta. Cada ajuste mostra Desfazer.
export function CopyEditor({ studentId, studentFirstName, copy, cardioOptions }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState<Record<string, Pending>>({});
  const pendingRef = useRef<Record<string, Pending>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [swapItem, setSwapItem] = useState<CopyItem | null>(null);
  const [options, setOptions] = useState<SwapOption[] | null>(null);
  const [addTo, setAddTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const active = timers.current;
    return () => Object.values(active).forEach(clearTimeout);
  }, []);

  async function send(edit: Record<string, unknown>, message: string) {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/students/${studentId}/copia`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(edit) });
    setBusy(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.message ?? "Não foi possível ajustar. Tente de novo.");
      return false;
    }
    const { previousPlanId } = (await response.json()) as { previousPlanId: string };
    toast.show(message, {
      label: "Desfazer",
      onClick: () => {
        void fetch(`/api/students/${studentId}/copia/restaurar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId: previousPlanId }) }).then(() => router.refresh());
      },
    });
    router.refresh();
    return true;
  }

  function nudge(item: CopyItem, change: Pending) {
    pendingRef.current = { ...pendingRef.current, [item.id]: { ...pendingRef.current[item.id], ...change } };
    setPending(pendingRef.current);
    clearTimeout(timers.current[item.id]);
    timers.current[item.id] = setTimeout(() => {
      const values = pendingRef.current[item.id];
      const rest = { ...pendingRef.current };
      delete rest[item.id];
      pendingRef.current = rest;
      setPending(rest);
      if (values) void send({ kind: "update", itemId: item.id, ...values }, `${item.name} ajustado só para ${studentFirstName}`);
    }, FLUSH_MS);
  }

  async function openSwap(item: CopyItem) {
    setSwapItem(item);
    setOptions(null);
    const response = await fetch(`/api/exercises/${item.exerciseId}/alternativas`);
    const body = response.ok ? ((await response.json()) as { options: SwapOption[] }) : { options: [] };
    setOptions(body.options);
  }

  async function swapTo(option: SwapOption) {
    if (!swapItem) return;
    const from = swapItem.name;
    if (await send({ kind: "swap", itemId: swapItem.id, exerciseId: option.id }, `${from} → ${option.name}, só para ${studentFirstName}`)) setSwapItem(null);
  }

  async function remove() {
    if (!swapItem) return;
    if (await send({ kind: "removeItem", itemId: swapItem.id }, `${swapItem.name} saiu do treino de ${studentFirstName}`)) setSwapItem(null);
  }

  async function addCardio(exercise: { id: string; name: string }) {
    if (!addTo) return;
    if (await send({ kind: "addItem", workoutId: addTo, exerciseId: exercise.id }, `${exercise.name} entrou no fim do treino`)) setAddTo(null);
  }

  return (
    <>
      <p className={styles.band}>Cópia do aluno. O que mudar aqui vale só para {studentFirstName}; o modelo da biblioteca não muda.</p>
      {error ? <FormAlert variant="error">{error}</FormAlert> : null}

      {copy.workouts.map((workout) => (
        <section key={workout.id} className={styles.workout} aria-labelledby={`w-${workout.id}`}>
          <h2 id={`w-${workout.id}`} className={styles.workoutTitle}>
            {workout.name}
            {workout.days.length > 0 ? <span className={styles.days}>{WEEKDAYS.filter((day) => workout.days.includes(day.key)).map((day) => day.short.toLowerCase()).join(", ")}</span> : null}
          </h2>
          <ul className={styles.items}>
            {workout.items.map((item) => {
              const local = pending[item.id] ?? {};
              const sets = local.sets ?? item.sets ?? 3;
              const reps = local.reps ?? item.reps ?? 12;
              const duration = local.durationSeconds ?? item.durationSeconds ?? 0;
              const timed = !item.isCardio && !item.reps && Boolean(item.durationSeconds);
              return (
                <li key={item.id} className={styles.item}>
                  <button type="button" className={styles.head} onClick={() => void openSwap(item)} aria-label={`Trocar ${item.name}`}>
                    {item.isCardio ? <CardioIcon size={48} /> : <ExerciseThumbnail src={item.imageUrl} alt={item.imageAlt ?? item.name} width={48} height={48} className={styles.thumb} />}
                    <span className={styles.text}>
                      <span className={item.isCardio ? `${styles.group} ${styles.cardioGroup}` : styles.group}>{item.isCardio ? "Aeróbico" : (item.muscle ?? "Exercício")}</span>
                      <span className={styles.name}>{item.name}</span>
                    </span>
                    <span className={styles.swap}>Trocar</span>
                  </button>
                  {item.isCardio ? (
                    <div className={styles.controls}>
                      <Stepper label="Minutos" hideLabel value={Math.round(duration / 60)} step={CARDIO_STEP_SECONDS / 60} min={CARDIO_MIN_SECONDS / 60} max={CARDIO_MAX_SECONDS / 60} format={(value) => `${value} min`} onChange={(value) => nudge(item, { durationSeconds: value * 60 })} />
                      <button
                        type="button"
                        className={styles.intensity}
                        disabled={busy}
                        onClick={() => {
                          const next = nextIntensity(item.intensity);
                          void send({ kind: "update", itemId: item.id, intensity: next }, `${item.name}: ${CARDIO_INTENSITY_LABELS[next].toLowerCase()}`);
                        }}
                      >
                        {CARDIO_INTENSITY_LABELS[(item.intensity ?? "MODERADO") as CardioIntensity]}
                      </button>
                    </div>
                  ) : (
                    <div className={styles.controls}>
                      <Stepper label="Séries" hideLabel value={sets} min={1} max={20} format={(value) => `${value} séries`} onChange={(value) => nudge(item, { sets: value })} />
                      {timed ? (
                        <Stepper label="Segundos" hideLabel value={duration} step={5} min={5} max={600} format={(value) => `${value} s`} onChange={(value) => nudge(item, { durationSeconds: value })} />
                      ) : (
                        <Stepper label="Repetições" hideLabel value={reps} min={1} max={200} format={(value) => `${value} reps`} onChange={(value) => nudge(item, { reps: value })} />
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <Button type="button" variant="secondary" block onClick={() => setAddTo(workout.id)}>
            Adicionar aeróbico
          </Button>
        </section>
      ))}

      <Button href={`/painel/treinos?aluno=${studentId}`} variant="quiet" block>
        Trocar o programa pela biblioteca
      </Button>

      <Sheet open={swapItem !== null} onClose={() => setSwapItem(null)} title={swapItem ? `Trocar ${swapItem.name}` : ""} description={swapItem ? (swapItem.isCardio ? "Outros aeróbicos" : `Outros de ${swapItem.muscle ?? "mesmo grupo"}`) : undefined} footer={<Button type="button" variant="quiet" block onClick={() => void remove()} disabled={busy}>Tirar do treino</Button>}>
        {options === null ? (
          <p className={styles.muted}>Carregando opções…</p>
        ) : options.length === 0 ? (
          <p className={styles.muted}>Nenhuma outra opção para este grupo.</p>
        ) : (
          <ul className={styles.tiles}>
            {options.map((option) => (
              <li key={option.id}>
                <button type="button" className={styles.tile} onClick={() => void swapTo(option)} disabled={busy}>
                  {swapItem?.isCardio ? <CardioIcon size={64} /> : <ExerciseThumbnail src={option.imageUrl} alt={option.imageAlt ?? option.name} width={160} height={110} className={styles.tileImage} />}
                  <span className={styles.tileName}>{option.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Sheet>

      <Sheet open={addTo !== null} onClose={() => setAddTo(null)} title="Adicionar aeróbico" description="Entra no fim do treino com 20 min, moderado.">
        <ul className={styles.tiles}>
          {cardioOptions.map((option) => (
            <li key={option.id}>
              <button type="button" className={styles.tile} onClick={() => void addCardio(option)} disabled={busy}>
                <CardioIcon size={64} />
                <span className={styles.tileName}>{option.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}
