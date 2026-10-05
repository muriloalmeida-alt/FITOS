"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, useToast } from "@/shared/ui";
import { requestJson } from "../_workout-builder/apiClient";
import { PERSONAL_WORKOUT_API, type EditorWorkout, type LibraryExercise, type ProgramOption } from "../_workout-builder/types";
import { WorkoutEditor } from "../_workout-builder/WorkoutEditor";
import styles from "./PersonalWorkoutEditor.module.css";

interface PersonalWorkoutEditorProps {
  initial: EditorWorkout | null;
  library: LibraryExercise[];
  programs: ProgramOption[];
  /// Programa que pediu este treino ("Montar um treino novo" na semana).
  returnToProgramId?: string | null;
}

async function addToProgram(programId: string, workoutId: string) {
  return requestJson<{ copied: boolean }>(`/api/training-plans/${programId}/modelos`, {
    method: "POST",
    body: JSON.stringify({ workoutId }),
  });
}

/// Editor de treino do Personal (FIT-146). "Pronto" pergunta o próximo
/// passo: colocar num programa (existente ou novo) ou voltar aos treinos.
export function PersonalWorkoutEditor({ initial, library, programs, returnToProgramId }: PersonalWorkoutEditorProps) {
  const router = useRouter();
  const toast = useToast();
  const [choosing, setChoosing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function place(programId: string, workoutId: string, close: () => void) {
    setBusy(true);
    try {
      const result = await addToProgram(programId, workoutId);
      toast.show(result.copied ? "Uma cópia do treino entrou no programa" : "Treino colocado no programa");
      close();
      router.push(`/painel/treinos/planos/${programId}`);
      router.refresh();
    } catch (error) {
      toast.show(error instanceof Error ? error.message : "Não foi possível colocar no programa.");
    } finally {
      setBusy(false);
    }
  }

  async function newProgram(workout: { id: string; name: string }, close: () => void) {
    setBusy(true);
    try {
      const plan = await requestJson<{ id: string }>("/api/training-plans", {
        method: "POST",
        body: JSON.stringify({ name: `Programa ${workout.name}`.slice(0, 120), durationWeeks: 8 }),
      });
      await place(plan.id, workout.id, close);
    } catch (error) {
      toast.show(error instanceof Error ? error.message : "Não foi possível criar o programa.");
      setBusy(false);
    }
  }

  return (
    <WorkoutEditor
      api={PERSONAL_WORKOUT_API}
      initial={initial}
      library={library}
      createExerciseHref="/painel/exercicios"
      onDoneHref={
        returnToProgramId
          ? async (workoutId) => {
              const result = await addToProgram(returnToProgramId, workoutId);
              toast.show(result.copied ? "Uma cópia do treino entrou no programa" : "Treino colocado no programa");
              return `/painel/treinos/planos/${returnToProgramId}`;
            }
          : undefined
      }
      renderActions={(workout) => (
        <>
          <Button
            type="button"
            variant="quiet"
            onClick={async () => {
              try {
                const copy = await requestJson<{ id: string }>(PERSONAL_WORKOUT_API.duplicate(workout.id), { method: "POST" });
                router.push(PERSONAL_WORKOUT_API.editorHref(copy.id));
              } catch (error) {
                toast.show(error instanceof Error ? error.message : "Não foi possível copiar.");
              }
            }}
          >
            Usar como base
          </Button>
          <Button
            type="button"
            variant="quiet"
            onClick={async () => {
              const action = workout.status === "ATIVO" ? "arquivar" : "reativar";
              try {
                await requestJson(`/api/workouts/${workout.id}/${action}`, { method: "POST" });
                toast.show(workout.status === "ATIVO" ? "Treino arquivado" : "Treino reativado");
                router.push(PERSONAL_WORKOUT_API.listHref);
                router.refresh();
              } catch (error) {
                toast.show(error instanceof Error ? error.message : "Não foi possível concluir.");
              }
            }}
          >
            {workout.status === "ATIVO" ? "Arquivar" : "Reativar"}
          </Button>
        </>
      )}
      renderDone={(workout, close) =>
        choosing ? (
          <div className={styles.options}>
            {programs.map((program) => (
              <button key={program.id} type="button" className={styles.option} disabled={busy} onClick={() => void place(program.id, workout.id, close)}>
                <span className={styles.optionName}>{program.name}</span>
                <span className={styles.optionMeta}>
                  {program.workoutCount} {program.workoutCount === 1 ? "treino" : "treinos"}
                </span>
              </button>
            ))}
            <Button type="button" variant="secondary" block disabled={busy} onClick={() => void newProgram(workout, close)}>
              + Novo programa com este treino
            </Button>
            <Button type="button" variant="quiet" block onClick={() => setChoosing(false)}>
              Voltar
            </Button>
          </div>
        ) : (
          <div className={styles.options}>
            <Button type="button" block onClick={() => setChoosing(true)}>
              Colocar em um programa
            </Button>
            <Button href={PERSONAL_WORKOUT_API.listHref} variant="quiet" block onClick={() => router.refresh()}>
              Voltar aos treinos
            </Button>
          </div>
        )
      }
    />
  );
}
