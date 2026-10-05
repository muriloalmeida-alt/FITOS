"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExerciseThumbnail, useToast } from "@/shared/ui";
import { formatDays } from "@/shared/lib/weekdays";
import { requestJson } from "./apiClient";
import { workoutApiFor, type WorkoutArea } from "./types";
import styles from "./WorkoutSummaryList.module.css";

export interface WorkoutSummaryRow {
  id: string;
  name: string;
  status: "ATIVO" | "ARQUIVADO";
  suggestedDays: string[];
  exerciseCount: number;
  trainingPlanName: string | null;
  thumbnails: { imageUrl: string; imageAlt: string | null }[];
}

interface WorkoutSummaryListProps {
  area: WorkoutArea;
  workouts: WorkoutSummaryRow[];
  /// Link "Começar" (FitOS Livre): base da rota, recebe `?treino=<id>`.
  startBase?: string;
}

/// Lista "Seus treinos" (FIT-146, reaproveitada pelo Livre na FIT-157):
/// fotos dos primeiros exercícios, contagem, dias, programa e ações de um
/// toque (Abrir, Usar como base, Arquivar/Reativar).
export function WorkoutSummaryList({ area, workouts, startBase }: WorkoutSummaryListProps) {
  const api = workoutApiFor(area);
  const lifecycleBase = api.create;
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function run(id: string, action: () => Promise<void>) {
    setBusy(id);
    try {
      await action();
    } catch (error) {
      toast.show(error instanceof Error ? error.message : "Não foi possível concluir.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <ul className={styles.list} aria-label="Seus treinos">
      {workouts.map((workout) => {
        const meta = [`${workout.exerciseCount} ${workout.exerciseCount === 1 ? "exercício" : "exercícios"}`, formatDays(workout.suggestedDays)];
        if (workout.trainingPlanName) meta.push(workout.trainingPlanName);
        return (
          <li key={workout.id} className={styles.row}>
            <div className={styles.head}>
              <span className={styles.thumbs} aria-hidden="true">
                {workout.thumbnails.map((thumb, index) => (
                  <ExerciseThumbnail key={`${thumb.imageUrl}-${index}`} src={thumb.imageUrl} alt="" width={40} height={40} className={styles.thumb} />
                ))}
              </span>
              <div className={styles.text}>
                <Link href={api.editorHref(workout.id)} className={styles.name}>
                  {workout.name}
                </Link>
                <span className={styles.meta}>{meta.join(" · ")}</span>
              </div>
            </div>
            <div className={styles.actions}>
              {workout.status === "ATIVO" ? (
                <>
                  {startBase ? (
                    <Link href={`${startBase}?treino=${workout.id}`} className={styles.action}>
                      Começar
                    </Link>
                  ) : null}
                  <Link href={api.editorHref(workout.id)} className={styles.action}>
                    Abrir
                  </Link>
                  <button
                    type="button"
                    className={styles.action}
                    disabled={busy === workout.id}
                    onClick={() =>
                      void run(workout.id, async () => {
                        const copy = await requestJson<{ id: string }>(api.duplicate(workout.id), { method: "POST" });
                        router.push(api.editorHref(copy.id));
                      })
                    }
                  >
                    Usar como base
                  </button>
                  <button
                    type="button"
                    className={`${styles.action} ${styles.quiet}`}
                    disabled={busy === workout.id}
                    onClick={() =>
                      void run(workout.id, async () => {
                        await requestJson(`${lifecycleBase}/${workout.id}/arquivar`, { method: "POST" });
                        toast.show(`${workout.name} arquivado`);
                        router.refresh();
                      })
                    }
                  >
                    Arquivar
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className={styles.action}
                  disabled={busy === workout.id}
                  onClick={() =>
                    void run(workout.id, async () => {
                      await requestJson(`${lifecycleBase}/${workout.id}/reativar`, { method: "POST" });
                      toast.show(`${workout.name} de volta aos ativos`);
                      router.refresh();
                    })
                  }
                >
                  Reativar
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
