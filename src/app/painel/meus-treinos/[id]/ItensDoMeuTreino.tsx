"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, ExerciseAutocomplete, FormAlert, TextField } from "@/shared/ui";
import styles from "./ItensDoMeuTreino.module.css";

export interface WorkoutItemProp {
  id: string;
  exerciseId: string;
  exerciseName: string;
  exerciseMuscle: string | null;
  sets: number | null;
  reps: number | null;
  durationSeconds: number | null;
  load: string | null;
  restSeconds: number | null;
  notes: string | null;
}

export interface CatalogExerciseOption {
  id: string;
  name: string;
  muscle?: string | null;
}

interface ItensDoMeuTreinoProps {
  workoutId: string;
  items: WorkoutItemProp[];
  catalog: CatalogExerciseOption[];
}

function prescriptionSummary(item: WorkoutItemProp): string {
  const parts: string[] = [];
  if (item.sets) {
    parts.push(`${item.sets} série${item.sets > 1 ? "s" : ""}`);
  }
  if (item.reps) {
    parts.push(`${item.reps} repetiç${item.reps > 1 ? "ões" : "ão"}`);
  }
  if (item.durationSeconds) {
    parts.push(`${item.durationSeconds}s de duração`);
  }
  if (item.load) {
    parts.push(`carga: ${item.load}`);
  }
  if (item.restSeconds) {
    parts.push(`descanso: ${item.restSeconds}s`);
  }
  return parts.length > 0 ? parts.join(" · ") : "Sem parâmetros de prescrição";
}

export function ItensDoMeuTreino({ workoutId, items, catalog }: ItensDoMeuTreinoProps) {
  const router = useRouter();
  const [exerciseId, setExerciseId] = useState("");
  const [sets, setSets] = useState("");
  const [reps, setReps] = useState("");
  const [durationSeconds, setDurationSeconds] = useState("");
  const [load, setLoad] = useState("");
  const [restSeconds, setRestSeconds] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);

  function parseOptionalInt(value: string): number | undefined {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return undefined;
    }
    const parsed = Number.parseInt(trimmed, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  async function handleAddSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }
    if (!exerciseId) {
      setFormError("Selecione um exercício.");
      return;
    }
    setFormError(null);
    setIsSubmitting(true);

    const response = await fetch(`/api/meus-treinos/${workoutId}/itens`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        exerciseId,
        sets: parseOptionalInt(sets),
        reps: parseOptionalInt(reps),
        durationSeconds: parseOptionalInt(durationSeconds),
        load: load.trim() || undefined,
        restSeconds: parseOptionalInt(restSeconds),
        notes: notes.trim() || undefined,
      }),
    });
    setIsSubmitting(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setFormError(body?.message ?? "Não foi possível adicionar o exercício. Tente novamente.");
      return;
    }

    setExerciseId("");
    setSets("");
    setReps("");
    setDurationSeconds("");
    setLoad("");
    setRestSeconds("");
    setNotes("");
    router.refresh();
  }

  async function handleRemove(itemId: string) {
    if (pendingItemId) {
      return;
    }
    setRowError(null);
    setPendingItemId(itemId);
    const response = await fetch(`/api/meus-treinos/${workoutId}/itens/${itemId}`, { method: "DELETE" });
    setPendingItemId(null);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setRowError(body?.message ?? "Não foi possível remover o item. Tente novamente.");
      return;
    }
    router.refresh();
  }

  async function handleMove(itemId: string, direction: "up" | "down") {
    if (pendingItemId) {
      return;
    }
    const currentIndex = items.findIndex((item) => item.id === itemId);
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= items.length) {
      return;
    }

    const orderedIds = items.map((item) => item.id);
    const temp = orderedIds[currentIndex]!;
    orderedIds[currentIndex] = orderedIds[targetIndex]!;
    orderedIds[targetIndex] = temp;

    setRowError(null);
    setPendingItemId(itemId);
    const response = await fetch(`/api/meus-treinos/${workoutId}/itens/reordenar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds }),
    });
    setPendingItemId(null);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setRowError(body?.message ?? "Não foi possível reordenar os itens. Tente novamente.");
      return;
    }
    router.refresh();
  }

  return (
    <div className={styles.container}>
      {items.length === 0 ? (
        <p className={styles.empty}>Nenhum exercício adicionado ainda.</p>
      ) : (
        <ul className={styles.list} aria-label="Exercícios do treino, em ordem">
          {items.map((item, index) => (
            <li key={item.id} className={styles.row}>
              <div className={styles.rowMain}>
                <span className={styles.exerciseName}>{item.exerciseName}</span>
                {item.exerciseMuscle ? <span className={styles.exerciseMuscle}>{item.exerciseMuscle}</span> : null}
                <span className={styles.summary}>{prescriptionSummary(item)}</span>
                {item.notes ? <span className={styles.notes}>{item.notes}</span> : null}
              </div>
              <div className={styles.rowActions}>
                <button
                  type="button"
                  className={styles.moveButton}
                  aria-label={`Mover ${item.exerciseName} para cima`}
                  onClick={() => handleMove(item.id, "up")}
                  disabled={pendingItemId !== null || index === 0}
                >
                  ▲
                </button>
                <button
                  type="button"
                  className={styles.moveButton}
                  aria-label={`Mover ${item.exerciseName} para baixo`}
                  onClick={() => handleMove(item.id, "down")}
                  disabled={pendingItemId !== null || index === items.length - 1}
                >
                  ▼
                </button>
                <Button
                  type="button"
                  variant="outlined"
                  onClick={() => handleRemove(item.id)}
                  disabled={pendingItemId !== null}
                >
                  {pendingItemId === item.id ? "Removendo…" : "Remover"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {rowError ? <FormAlert variant="error">{rowError}</FormAlert> : null}

      <form className={styles.addForm} onSubmit={handleAddSubmit} noValidate>
        <h3 className={styles.addFormTitle}>Adicionar exercício</h3>
        {formError ? <FormAlert variant="error">{formError}</FormAlert> : null}

        <ExerciseAutocomplete
          label="Exercício"
          name="exerciseId"
          options={catalog}
          value={exerciseId}
          onChange={setExerciseId}
          placeholder="Buscar exercício por nome"
          disabled={isSubmitting}
        />

        <div className={styles.paramsGrid}>
          <TextField
            label="Séries"
            name="sets"
            type="number"
            min={1}
            value={sets}
            onChange={(event) => setSets(event.target.value)}
            disabled={isSubmitting}
          />
          <TextField
            label="Repetições"
            name="reps"
            type="number"
            min={1}
            value={reps}
            onChange={(event) => setReps(event.target.value)}
            disabled={isSubmitting}
          />
          <TextField
            label="Duração (s)"
            name="durationSeconds"
            type="number"
            min={1}
            value={durationSeconds}
            onChange={(event) => setDurationSeconds(event.target.value)}
            disabled={isSubmitting}
          />
          <TextField
            label="Carga"
            name="load"
            type="text"
            value={load}
            onChange={(event) => setLoad(event.target.value)}
            disabled={isSubmitting}
          />
          <TextField
            label="Descanso (s)"
            name="restSeconds"
            type="number"
            min={1}
            value={restSeconds}
            onChange={(event) => setRestSeconds(event.target.value)}
            disabled={isSubmitting}
          />
          <TextField
            label="Observação"
            name="notes"
            type="text"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            disabled={isSubmitting}
          />
        </div>

        <Button type="submit" variant="filled" disabled={isSubmitting}>
          {isSubmitting ? "Adicionando…" : "Adicionar exercício"}
        </Button>
      </form>
    </div>
  );
}
