"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, FormAlert } from "@/shared/ui";
import styles from "./ModelosDoPrograma.module.css";

export interface PlanWorkoutProp {
  id: string;
  name: string;
  suggestedDays: string[];
}

export interface AvailableWorkoutOption {
  id: string;
  name: string;
}

interface ModelosDoProgramaProps {
  trainingPlanId: string;
  workouts: PlanWorkoutProp[];
  availableWorkouts: AvailableWorkoutOption[];
}

export function ModelosDoPrograma({ trainingPlanId, workouts, availableWorkouts }: ModelosDoProgramaProps) {
  const router = useRouter();
  const [selectedWorkoutId, setSelectedWorkoutId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const [pendingWorkoutId, setPendingWorkoutId] = useState<string | null>(null);

  async function handleAddSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }
    if (!selectedWorkoutId) {
      setFormError("Selecione um modelo.");
      return;
    }
    setFormError(null);
    setIsSubmitting(true);

    const response = await fetch(`/api/training-plans/${trainingPlanId}/modelos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workoutId: selectedWorkoutId }),
    });
    setIsSubmitting(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setFormError(body?.message ?? "Não foi possível adicionar o modelo. Tente novamente.");
      return;
    }

    setSelectedWorkoutId("");
    router.refresh();
  }

  async function handleRemove(workoutId: string) {
    if (pendingWorkoutId) {
      return;
    }
    setRowError(null);
    setPendingWorkoutId(workoutId);
    const response = await fetch(`/api/training-plans/${trainingPlanId}/modelos/${workoutId}`, { method: "DELETE" });
    setPendingWorkoutId(null);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setRowError(body?.message ?? "Não foi possível remover o modelo do programa. Tente novamente.");
      return;
    }
    router.refresh();
  }

  async function handleMove(workoutId: string, direction: "up" | "down") {
    if (pendingWorkoutId) {
      return;
    }
    const currentIndex = workouts.findIndex((workout) => workout.id === workoutId);
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= workouts.length) {
      return;
    }

    const orderedWorkoutIds = workouts.map((workout) => workout.id);
    const temp = orderedWorkoutIds[currentIndex]!;
    orderedWorkoutIds[currentIndex] = orderedWorkoutIds[targetIndex]!;
    orderedWorkoutIds[targetIndex] = temp;

    setRowError(null);
    setPendingWorkoutId(workoutId);
    const response = await fetch(`/api/training-plans/${trainingPlanId}/modelos/reordenar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedWorkoutIds }),
    });
    setPendingWorkoutId(null);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setRowError(body?.message ?? "Não foi possível reordenar os modelos. Tente novamente.");
      return;
    }
    router.refresh();
  }

  return (
    <div className={styles.container}>
      {workouts.length === 0 ? (
        <p className={styles.empty}>Nenhum modelo agrupado neste programa ainda.</p>
      ) : (
        <ul className={styles.list} aria-label="Modelos do programa, em ordem">
          {workouts.map((workout, index) => (
            <li key={workout.id} className={styles.row}>
              <div className={styles.rowMain}>
                <Link href={`/painel/treinos/${workout.id}`} className={styles.workoutName}>
                  {workout.name}
                </Link>
                {workout.suggestedDays.length > 0 ? (
                  <span className={styles.days}>{workout.suggestedDays.join(", ")}</span>
                ) : null}
              </div>
              <div className={styles.rowActions}>
                <button
                  type="button"
                  className={styles.moveButton}
                  aria-label={`Mover ${workout.name} para cima`}
                  onClick={() => handleMove(workout.id, "up")}
                  disabled={pendingWorkoutId !== null || index === 0}
                >
                  ▲
                </button>
                <button
                  type="button"
                  className={styles.moveButton}
                  aria-label={`Mover ${workout.name} para baixo`}
                  onClick={() => handleMove(workout.id, "down")}
                  disabled={pendingWorkoutId !== null || index === workouts.length - 1}
                >
                  ▼
                </button>
                <Button
                  type="button"
                  variant="outlined"
                  onClick={() => handleRemove(workout.id)}
                  disabled={pendingWorkoutId !== null}
                >
                  {pendingWorkoutId === workout.id ? "Removendo…" : "Remover"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {rowError ? <FormAlert variant="error">{rowError}</FormAlert> : null}

      <form className={styles.addForm} onSubmit={handleAddSubmit} noValidate>
        <h3 className={styles.addFormTitle}>Adicionar modelo</h3>
        {formError ? <FormAlert variant="error">{formError}</FormAlert> : null}

        {availableWorkouts.length === 0 ? (
          <p className={styles.empty}>
            Nenhum outro modelo disponível para adicionar.{" "}
            <Link href="/painel/treinos/novo" className={styles.link}>
              Criar um modelo
            </Link>
            .
          </p>
        ) : (
          <>
            <div className={styles.selectField}>
              <label className={styles.selectLabel} htmlFor="workoutId">
                Modelo
              </label>
              <select
                id="workoutId"
                className={styles.select}
                value={selectedWorkoutId}
                onChange={(event) => setSelectedWorkoutId(event.target.value)}
                disabled={isSubmitting}
              >
                <option value="">Selecione um modelo</option>
                {availableWorkouts.map((workout) => (
                  <option key={workout.id} value={workout.id}>
                    {workout.name}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" variant="filled" disabled={isSubmitting}>
              {isSubmitting ? "Adicionando…" : "Adicionar modelo"}
            </Button>
          </>
        )}
      </form>
    </div>
  );
}
