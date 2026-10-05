"use client";

import { useState } from "react";
import { Button, CardioIcon, ExerciseThumbnail, Tag } from "@/shared/ui";
import { formatDays } from "@/shared/lib/weekdays";
import { prescriptionLine, type PrescriptionInput } from "@/shared/lib/prescription";
import styles from "./page.module.css";

export interface ProgramWorkoutView {
  id: string;
  name: string;
  days: string[];
  today: boolean;
  items: (PrescriptionInput & { id: string; name: string; muscle: string | null; imageUrl: string | null; imageAlt: string | null; notes: string | null })[];
}

/// "5 exercícios" ou, num treino só de aeróbico, "24 min" (EPIC-28).
function workoutAmount(workout: ProgramWorkoutView): string {
  if (workout.items.length > 0 && workout.items.every((item) => item.intensity)) {
    return `${Math.round(workout.items.reduce((sum, item) => sum + (item.durationSeconds ?? 0), 0) / 60)} min de aeróbico`;
  }
  return `${workout.items.length} ${workout.items.length === 1 ? "exercício" : "exercícios"}`;
}

/// Treinos do programa que abrem e fecham (FIT-152). Abre o de hoje (ou o
/// primeiro); cada um termina em "Começar este treino".
export function ProgramWorkouts({ workouts }: { workouts: ProgramWorkoutView[] }) {
  const [open, setOpen] = useState<string | null>((workouts.find((workout) => workout.today) ?? workouts[0])?.id ?? null);

  return (
    <ul className={styles.workouts}>
      {workouts.map((workout) => {
        const expanded = open === workout.id;
        return (
          <li key={workout.id} className={expanded ? `${styles.workout} ${styles.workoutOpen}` : styles.workout}>
            <button type="button" className={styles.workoutHead} aria-expanded={expanded} aria-controls={`treino-${workout.id}`} onClick={() => setOpen(expanded ? null : workout.id)}>
              <span className={styles.workoutText}>
                <span className={styles.workoutName}>
                  {workout.name} {workout.today ? <Tag tone="accent">Hoje</Tag> : null}
                </span>
                <span className={styles.workoutMeta}>
                  {workoutAmount(workout)} · {formatDays(workout.days)}
                </span>
              </span>
              <span className={styles.chevron} aria-hidden="true">
                {expanded ? "−" : "+"}
              </span>
            </button>
            {expanded ? (
              <div id={`treino-${workout.id}`} className={styles.workoutBody}>
                {workout.items.length === 0 ? (
                  <p className={styles.muted}>Este treino ainda não tem exercícios.</p>
                ) : (
                  <ol className={styles.items} aria-label={`Exercícios de ${workout.name}`}>
                    {workout.items.map((item) => (
                      <li key={item.id} className={styles.item}>
                        {item.intensity ? <CardioIcon size={56} /> : <ExerciseThumbnail src={item.imageUrl} alt={item.imageAlt ?? item.name} width={56} height={56} className={styles.thumb} />}
                        <span className={styles.itemText}>
                          <span className={styles.itemName}>{item.name}</span>
                          <span className={styles.muted}>{prescriptionLine(item)}</span>
                          {item.notes ? <span className={styles.note}>“{item.notes}”</span> : null}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
                {workout.items.length > 0 ? (
                  <Button href={`/painel/treino/sessao?treino=${workout.id}`} size="lg" block>
                    Começar este treino
                  </Button>
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
