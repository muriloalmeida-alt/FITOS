"use client";

import { useRouter } from "next/navigation";
import { Button, useToast } from "@/shared/ui";
import { requestJson } from "../_workout-builder/apiClient";
import { LIVRE_WORKOUT_API, type EditorWorkout, type LibraryExercise } from "../_workout-builder/types";
import { WorkoutEditor } from "../_workout-builder/WorkoutEditor";
import styles from "../treinos/PersonalWorkoutEditor.module.css";

/// Editor de treino do FitOS Livre (FIT-157): o mesmo editor do Personal
/// (FIT-146), sem programas nem atribuição. "Pronto" oferece "Começar
/// agora".
export function LivreWorkoutEditor({ initial, library }: { initial: EditorWorkout | null; library: LibraryExercise[] }) {
  const router = useRouter();
  const toast = useToast();

  return (
    <WorkoutEditor
      api={LIVRE_WORKOUT_API}
      initial={initial}
      library={library}
      createExerciseHref="/painel/exercicios?origem=meus&novo=1"
      renderActions={(workout) => (
        <>
          <Button
            type="button"
            variant="quiet"
            onClick={async () => {
              try {
                const copy = await requestJson<{ id: string }>(LIVRE_WORKOUT_API.duplicate(workout.id), { method: "POST" });
                router.push(LIVRE_WORKOUT_API.editorHref(copy.id));
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
                await requestJson(`/api/meus-treinos/${workout.id}/${action}`, { method: "POST" });
                toast.show(workout.status === "ATIVO" ? "Treino arquivado" : "Treino reativado");
                router.push(LIVRE_WORKOUT_API.listHref);
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
      renderDone={(workout) => (
        <div className={styles.options}>
          <Button href={`/painel/meus-treinos/sessao?treino=${workout.id}`} block size="lg">
            Começar agora
          </Button>
          <Button href={LIVRE_WORKOUT_API.listHref} variant="quiet" block onClick={() => router.refresh()}>
            Voltar aos treinos
          </Button>
        </div>
      )}
    />
  );
}
