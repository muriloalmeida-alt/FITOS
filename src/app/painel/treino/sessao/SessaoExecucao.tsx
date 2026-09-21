"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, FormAlert, TextField } from "@/shared/ui";
import styles from "./SessaoExecucao.module.css";

export interface SessionItemResult {
  setsCompleted: number | null;
  repsCompleted: number | null;
  durationSecondsCompleted: number | null;
  loadUsed: string | null;
}

export interface SessionItemProp {
  id: string;
  exerciseName: string;
  exerciseMuscle: string | null;
  instructions: string | null;
  sets: number | null;
  reps: number | null;
  durationSeconds: number | null;
  load: string | null;
  restSeconds: number | null;
  notes: string | null;
  result: SessionItemResult | null;
}

interface SessaoExecucaoProps {
  sessionId: string;
  items: SessionItemProp[];
}

interface FieldValues {
  sets: string;
  reps: string;
  duration: string;
  load: string;
}

function initialFieldValues(item: SessionItemProp): FieldValues {
  return {
    sets: item.result?.setsCompleted != null ? String(item.result.setsCompleted) : "",
    reps: item.result?.repsCompleted != null ? String(item.result.repsCompleted) : "",
    duration: item.result?.durationSecondsCompleted != null ? String(item.result.durationSecondsCompleted) : "",
    load: item.result?.loadUsed ?? "",
  };
}

function prescriptionSummary(item: SessionItemProp): string {
  const parts: string[] = [];
  if (item.sets) parts.push(`${item.sets} série${item.sets > 1 ? "s" : ""}`);
  if (item.reps) parts.push(`${item.reps} repetiç${item.reps > 1 ? "ões" : "ão"}`);
  if (item.durationSeconds) parts.push(`${item.durationSeconds}s de duração`);
  if (item.load) parts.push(`carga: ${item.load}`);
  if (item.restSeconds) parts.push(`descanso: ${item.restSeconds}s`);
  return parts.length > 0 ? parts.join(" · ") : "Sem parâmetros de prescrição";
}

/// Temporizador de descanso (FIT-041): acessível (`aria-live="polite"`,
/// anuncia a contagem sem exigir foco) e não bloqueante — nenhum outro
/// controle da tela é desabilitado enquanto ele conta, e "Pular" encerra
/// a qualquer momento.
function DescansoTimer({ restSeconds }: { restSeconds: number }) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  function start() {
    setRemaining(restSeconds);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    intervalRef.current = setInterval(() => {
      setRemaining((current) => {
        if (current === null || current <= 1) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          return null;
        }
        return current - 1;
      });
    }, 1000);
  }

  function skip() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setRemaining(null);
  }

  return (
    <div className={styles.timerBox}>
      {remaining === null ? (
        <Button type="button" variant="outlined" onClick={start}>
          Iniciar descanso ({restSeconds}s)
        </Button>
      ) : (
        <>
          <span aria-live="polite">
            Descanso: <span className={styles.timerCount}>{remaining}s</span>
          </span>
          <Button type="button" variant="outlined" onClick={skip}>
            Pular descanso
          </Button>
        </>
      )}
    </div>
  );
}

/// Execução da sessão (FIT-041): um card por item, com campos para o
/// resultado executado (independentes dos prescritos —
/// `REGRAS-DE-NEGOCIO.md`, seção 6), "Repetir prescrito" em um toque, o
/// temporizador de descanso, e "Concluir"/"Abandonar" no fim. Cada
/// "Salvar" é um upsert idempotente no servidor — reenviar o mesmo item
/// nunca duplica; o botão também fica desabilitado durante o envio
/// (defesa em duas camadas, mesmo padrão do restante da aplicação).
export function SessaoExecucao({ sessionId, items }: SessaoExecucaoProps) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, FieldValues>>(() =>
    Object.fromEntries(items.map((item) => [item.id, initialFieldValues(item)]))
  );
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({});
  const [savedItemIds, setSavedItemIds] = useState<Record<string, boolean>>({});
  const [isFinishing, setIsFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

  function updateField(itemId: string, field: keyof FieldValues, value: string) {
    setValues((current) => ({ ...current, [itemId]: { ...current[itemId]!, [field]: value } }));
    setSavedItemIds((current) => ({ ...current, [itemId]: false }));
  }

  function repetirPrescrito(item: SessionItemProp) {
    updateField(item.id, "sets", item.sets != null ? String(item.sets) : "");
    updateField(item.id, "reps", item.reps != null ? String(item.reps) : "");
    updateField(item.id, "duration", item.durationSeconds != null ? String(item.durationSeconds) : "");
    updateField(item.id, "load", item.load ?? "");
  }

  async function salvarResultado(item: SessionItemProp) {
    if (savingItemId) {
      return;
    }
    setItemErrors((current) => ({ ...current, [item.id]: "" }));
    setSavingItemId(item.id);
    const field = values[item.id]!;
    try {
      const response = await fetch(`/api/workout-sessions/${sessionId}/resultados`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workoutExerciseId: item.id,
          setsCompleted: field.sets.trim() === "" ? null : Number(field.sets),
          repsCompleted: field.reps.trim() === "" ? null : Number(field.reps),
          durationSecondsCompleted: field.duration.trim() === "" ? null : Number(field.duration),
          loadUsed: field.load.trim() === "" ? null : field.load.trim(),
        }),
      });
      setSavingItemId(null);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setItemErrors((current) => ({ ...current, [item.id]: body?.message ?? "Não foi possível salvar. Tente novamente." }));
        return;
      }
      setSavedItemIds((current) => ({ ...current, [item.id]: true }));
    } catch {
      setSavingItemId(null);
      setItemErrors((current) => ({ ...current, [item.id]: "Falha de conexão. Verifique sua internet e tente novamente." }));
    }
  }

  async function finalizar(action: "concluir" | "abandonar") {
    if (isFinishing) {
      return;
    }
    setFinishError(null);
    setIsFinishing(true);
    try {
      const response = await fetch(`/api/workout-sessions/${sessionId}/${action}`, { method: "POST" });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setFinishError(body?.message ?? "Não foi possível concluir a ação. Tente novamente.");
        setIsFinishing(false);
        return;
      }
      router.push("/painel");
    } catch {
      setFinishError("Falha de conexão. Verifique sua internet e tente novamente.");
      setIsFinishing(false);
    }
  }

  return (
    <div className={styles.container}>
      {items.length === 0 ? (
        <p className={styles.empty}>Este treino ainda não tem exercícios.</p>
      ) : (
        items.map((item) => {
          const field = values[item.id]!;
          return (
            <div key={item.id} className={styles.itemCard}>
              <span className={styles.exerciseName}>{item.exerciseName}</span>
              {item.exerciseMuscle ? <span className={styles.exerciseMuscle}>{item.exerciseMuscle}</span> : null}
              <span className={styles.summary}>{prescriptionSummary(item)}</span>
              {item.notes ? <span className={styles.notes}>{item.notes}</span> : null}
              {item.instructions ? <span className={styles.instructions}>{item.instructions}</span> : null}

              <div className={styles.fieldsGrid}>
                <TextField
                  label="Séries executadas"
                  name={`sets-${item.id}`}
                  type="number"
                  min={1}
                  value={field.sets}
                  onChange={(event) => updateField(item.id, "sets", event.target.value)}
                  disabled={savingItemId === item.id}
                />
                <TextField
                  label="Repetições executadas"
                  name={`reps-${item.id}`}
                  type="number"
                  min={1}
                  value={field.reps}
                  onChange={(event) => updateField(item.id, "reps", event.target.value)}
                  disabled={savingItemId === item.id}
                />
                <TextField
                  label="Duração executada (s)"
                  name={`duration-${item.id}`}
                  type="number"
                  min={1}
                  value={field.duration}
                  onChange={(event) => updateField(item.id, "duration", event.target.value)}
                  disabled={savingItemId === item.id}
                />
                <TextField
                  label="Carga utilizada"
                  name={`load-${item.id}`}
                  type="text"
                  value={field.load}
                  onChange={(event) => updateField(item.id, "load", event.target.value)}
                  disabled={savingItemId === item.id}
                />
              </div>

              {itemErrors[item.id] ? <FormAlert variant="error">{itemErrors[item.id]}</FormAlert> : null}

              <div className={styles.itemActions}>
                <Button type="button" variant="outlined" onClick={() => repetirPrescrito(item)} disabled={savingItemId === item.id}>
                  Repetir prescrito
                </Button>
                <Button type="button" variant="filled" onClick={() => salvarResultado(item)} disabled={savingItemId === item.id}>
                  {savingItemId === item.id ? "Salvando…" : "Salvar resultado"}
                </Button>
                {savedItemIds[item.id] ? <span className={styles.savedBadge}>Salvo</span> : null}
              </div>

              {item.restSeconds ? <DescansoTimer restSeconds={item.restSeconds} /> : null}
            </div>
          );
        })
      )}

      {finishError ? <FormAlert variant="error">{finishError}</FormAlert> : null}
      <div className={styles.footerActions}>
        <Button type="button" variant="filled" onClick={() => finalizar("concluir")} disabled={isFinishing}>
          {isFinishing ? "Enviando…" : "Concluir treino"}
        </Button>
        <Button type="button" variant="outlined" onClick={() => finalizar("abandonar")} disabled={isFinishing}>
          Abandonar treino
        </Button>
      </div>
    </div>
  );
}
