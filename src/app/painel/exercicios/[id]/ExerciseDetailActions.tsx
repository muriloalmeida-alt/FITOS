"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, useToast } from "@/shared/ui";
import { requestJson } from "../../_workout-builder/apiClient";
import { ExerciseFormSheet, type ExerciseFormValues } from "../ExerciseForm";
import styles from "./page.module.css";

interface ExerciseDetailActionsProps {
  exerciseId: string;
  own: boolean;
  status: "ATIVO" | "ARQUIVADO";
  initial: ExerciseFormValues;
  muscles: string[];
  types: string[];
}

/// Ações do detalhe do exercício (FIT-147).
export function ExerciseDetailActions({ exerciseId, own, status, initial, muscles, types }: ExerciseDetailActionsProps) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      toast.show(error instanceof Error ? error.message : "Não foi possível concluir.");
    } finally {
      setBusy(false);
    }
  }

  if (!own) {
    return (
      <div className={styles.actions}>
        <p className={styles.muted}>Exercício da biblioteca FitOS. Para mudar algo, crie uma versão sua.</p>
        <Button
          type="button"
          variant="quiet"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const copy = await requestJson<{ id: string }>(`/api/exercises/${exerciseId}/copiar`, { method: "POST" });
              toast.show("Versão sua criada");
              router.push(`/painel/exercicios/${copy.id}`);
            })
          }
        >
          Criar uma versão minha
        </Button>
      </div>
    );
  }

  return (
    <div className={styles.actions}>
      <h2 className={styles.cap}>Seu exercício</h2>
      <div className={styles.actionRow}>
        <Button type="button" variant="quiet" onClick={() => setEditing(true)}>
          Editar
        </Button>
        <Button
          type="button"
          variant="quiet"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const action = status === "ATIVO" ? "arquivar" : "reativar";
              await requestJson(`/api/exercises/${exerciseId}/${action}`, { method: "POST" });
              toast.show(status === "ATIVO" ? "Exercício arquivado. Treinos que já usam continuam iguais." : "Exercício reativado");
              router.refresh();
            })
          }
        >
          {status === "ATIVO" ? "Arquivar" : "Reativar"}
        </Button>
      </div>
      {editing ? <ExerciseFormSheet open exerciseId={exerciseId} initial={initial} muscles={muscles} types={types} onClose={() => setEditing(false)} /> : null}
    </div>
  );
}
