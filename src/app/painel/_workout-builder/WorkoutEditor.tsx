"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, CardioIcon, ChipGroup, ExerciseThumbnail, FormAlert, Sheet, useToast } from "@/shared/ui";
import { WEEKDAYS, formatDays } from "@/shared/lib/weekdays";
import { ExerciseLibrary } from "./ExerciseLibrary";
import { WorkoutItemCard, type ItemPatch } from "./WorkoutItemCard";
import { requestJson as request } from "./apiClient";
import type { EditorItem, EditorWorkout, LibraryExercise, WorkoutApi } from "./types";
import styles from "./WorkoutEditor.module.css";

type SaveState = "idle" | "saving" | "saved" | "error";

interface WorkoutEditorProps {
  api: WorkoutApi;
  /// `null` = treino novo, ainda não salvo (é criado no primeiro gesto).
  initial: EditorWorkout | null;
  library: LibraryExercise[];
  createExerciseHref?: string | null;
  /// Conteúdo da sheet "Pronto" (próximo passo), recebe o treino salvo.
  renderDone: (workout: { id: string; name: string; summary: string }, close: () => void) => ReactNode;
  /// Ações extras do treino salvo (ex.: Usar como base, Arquivar).
  renderActions?: (workout: { id: string; status: "ATIVO" | "ARQUIVADO" }) => ReactNode;
  /// Pronto leva direto para cá, sem sheet (ex.: voltar ao programa que pediu o treino).
  onDoneHref?: (workoutId: string) => Promise<string | null>;
  /// Prescrição com que os exercícios entram (padrão do espaço, EPIC-36).
  prescription?: { sets: number; reps: number; restSeconds: number };
}

const DEFAULT_NAME = "Novo treino";
const SAVE_DEBOUNCE_MS = 450;

function toServerPatch(patch: ItemPatch): Record<string, unknown> {
  const body: Record<string, unknown> = { ...patch };
  if ("load" in patch) body.load = patch.load ?? "";
  if ("notes" in patch) body.notes = patch.notes ?? "";
  if ("restSeconds" in patch) body.restSeconds = patch.restSeconds && patch.restSeconds > 0 ? patch.restSeconds : null;
  return body;
}

/// Editor de treino sem formulário (FIT-146; reaproveitado pelo FitOS Livre
/// na FIT-157). Nome no título, dias em botões, exercícios pela biblioteca
/// (vários de uma vez) e prescrição com +/−. Tudo salva sozinho; o treino
/// novo só é criado no primeiro gesto do usuário (nunca um treino vazio
/// fantasma por abrir a tela).
export function WorkoutEditor({ api, initial, library, createExerciseHref, renderDone, renderActions, onDoneHref, prescription = { sets: 3, reps: 12, restSeconds: 60 } }: WorkoutEditorProps) {
  const router = useRouter();
  const toast = useToast();
  const [workoutId, setWorkoutId] = useState<string | null>(initial?.id ?? null);
  const [name, setName] = useState(initial?.name ?? "");
  const [days, setDays] = useState<string[]>(initial?.suggestedDays ?? []);
  const [items, setItems] = useState<EditorItem[]>(initial?.items ?? []);
  const [status] = useState<"ATIVO" | "ARQUIVADO">(initial?.status ?? "ATIVO");
  const [saveState, setSaveState] = useState<SaveState>(initial ? "saved" : "idle");
  const [error, setError] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  // Troca pelo mesmo grupo muscular (EPIC-30).
  const [swapItem, setSwapItem] = useState<EditorItem | null>(null);
  const [swapOptions, setSwapOptions] = useState<{ id: string; name: string; muscle: string | null; imageUrl: string | null; imageAlt: string | null }[] | null>(null);
  const creating = useRef<Promise<string> | null>(null);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pending = useRef(new Map<string, Record<string, unknown>>());
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!initial) titleRef.current?.focus();
    const currentTimers = timers.current;
    return () => currentTimers.forEach((timer) => clearTimeout(timer));
  }, [initial]);

  const fail = useCallback((message: string) => {
    setSaveState("error");
    setError(message);
  }, []);

  /// Garante que o treino existe no servidor (cria no primeiro gesto).
  const ensureWorkout = useCallback(async (): Promise<string> => {
    if (workoutId) return workoutId;
    if (!creating.current) {
      creating.current = (async () => {
        const created = (await request(api.create, { method: "POST", body: JSON.stringify({ name: name.trim() || DEFAULT_NAME }) })) as { id: string };
        setWorkoutId(created.id);
        window.history.replaceState(null, "", api.editorHref(created.id) + window.location.search);
        return created.id;
      })();
    }
    return creating.current;
  }, [api, name, workoutId]);

  /// Agrupa alterações rápidas (vários toques no +) numa só requisição.
  const scheduleSave = useCallback(
    (key: string, url: (id: string) => string, body: Record<string, unknown>) => {
      pending.current.set(key, { ...(pending.current.get(key) ?? {}), ...body });
      setSaveState("saving");
      setError(null);
      const existing = timers.current.get(key);
      if (existing) clearTimeout(existing);
      timers.current.set(
        key,
        setTimeout(async () => {
          timers.current.delete(key);
          const payload = pending.current.get(key) ?? {};
          pending.current.delete(key);
          try {
            const id = await ensureWorkout();
            await request(url(id), { method: "PATCH", body: JSON.stringify(payload) });
            if (timers.current.size === 0) setSaveState("saved");
          } catch (cause) {
            fail(cause instanceof Error ? cause.message : "Não foi possível salvar.");
          }
        }, SAVE_DEBOUNCE_MS)
      );
    },
    [ensureWorkout, fail]
  );

  function onNameChange(value: string) {
    setName(value);
    if (value.trim().length === 0) return;
    scheduleSave("workout", api.workout, { name: value.trim() });
  }

  function onDaysChange(next: string[]) {
    setDays(next);
    scheduleSave("workout", api.workout, { suggestedDays: next });
  }

  async function openSwap(item: EditorItem) {
    setSwapItem(item);
    setSwapOptions(null);
    try {
      const { options } = await request<{ options: NonNullable<typeof swapOptions> }>(`/api/exercises/${item.exerciseId}/alternativas`);
      setSwapOptions(options.filter((option) => !items.some((other) => other.exerciseId === option.id)));
    } catch {
      setSwapOptions([]);
    }
  }

  async function swapTo(option: NonNullable<typeof swapOptions>[number]) {
    const item = swapItem;
    if (!item || !workoutId) return;
    setSwapItem(null);
    const previous = items;
    setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, exerciseId: option.id, name: option.name, muscle: option.muscle, imageUrl: option.imageUrl, imageAlt: option.imageAlt } : entry)));
    try {
      await request(api.item(workoutId, item.id), { method: "PATCH", body: JSON.stringify({ exerciseId: option.id }) });
      toast.show(`${item.name} → ${option.name}`, {
        label: "Desfazer",
        onClick: () => {
          setItems((current) => current.map((entry) => (entry.id === item.id ? item : entry)));
          void request(api.item(workoutId, item.id), { method: "PATCH", body: JSON.stringify({ exerciseId: item.exerciseId }) });
        },
      });
    } catch (cause) {
      setItems(previous);
      setError(cause instanceof Error ? cause.message : "Não foi possível trocar.");
    }
  }

  function onItemChange(itemId: string, patch: ItemPatch) {
    setItems((current) => current.map((item) => (item.id === itemId ? { ...item, ...patch } : item)));
    scheduleSave(`item:${itemId}`, (id) => api.item(id, itemId), toServerPatch(patch));
  }

  async function onAdd(exerciseIds: string[]) {
    setAdding(true);
    setError(null);
    try {
      const id = await ensureWorkout();
      const created = (await request(api.batch(id), { method: "POST", body: JSON.stringify({ exerciseIds }) })) as {
        id: string;
        exerciseId: string;
        sets: number | null;
        reps: number | null;
        durationSeconds: number | null;
        load: string | null;
        restSeconds: number | null;
        notes: string | null;
        intensity: EditorItem["intensity"];
      }[];
      const byId = new Map(library.map((exercise) => [exercise.id, exercise]));
      setItems((current) => [
        ...current,
        ...created.map((item) => {
          const exercise = byId.get(item.exerciseId);
          return {
            ...item,
            name: exercise?.name ?? "Exercício",
            muscle: exercise?.muscle ?? null,
            imageUrl: exercise?.imageUrl ?? null,
            imageAlt: exercise?.imageAlt ?? null,
          };
        }),
      ]);
      setLibraryOpen(false);
      setSaveState("saved");
      toast.show(created.length === 1 ? "1 exercício adicionado" : `${created.length} exercícios adicionados`);
    } catch (cause) {
      fail(cause instanceof Error ? cause.message : "Não foi possível adicionar.");
    } finally {
      setAdding(false);
    }
  }

  async function onMove(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length || !workoutId) return;
    const next = [...items];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setItems(next);
    setSaveState("saving");
    try {
      await request(api.reorder(workoutId), { method: "POST", body: JSON.stringify({ orderedIds: next.map((item) => item.id) }) });
      setSaveState("saved");
    } catch (cause) {
      fail(cause instanceof Error ? cause.message : "Não foi possível reordenar.");
    }
  }

  async function onRemove(itemId: string) {
    if (!workoutId) return;
    const previous = items;
    setItems((current) => current.filter((item) => item.id !== itemId));
    try {
      await request(api.item(workoutId, itemId), { method: "DELETE" });
      toast.show("Exercício removido");
    } catch (cause) {
      setItems(previous);
      fail(cause instanceof Error ? cause.message : "Não foi possível remover.");
    }
  }

  async function flush() {
    for (const [key, timer] of timers.current) {
      clearTimeout(timer);
      timers.current.delete(key);
      const payload = pending.current.get(key) ?? {};
      pending.current.delete(key);
      const id = await ensureWorkout();
      const url = key === "workout" ? api.workout(id) : api.item(id, key.slice("item:".length));
      await request(url, { method: "PATCH", body: JSON.stringify(payload) });
    }
  }

  async function onDone() {
    try {
      await flush();
      setSaveState("saved");
      const id = await ensureWorkout();
      if (onDoneHref) {
        const href = await onDoneHref(id);
        if (href) {
          router.push(href);
          router.refresh();
          return;
        }
      }
      setDoneOpen(true);
    } catch (cause) {
      fail(cause instanceof Error ? cause.message : "Não foi possível salvar.");
    }
  }

  const totalSets = items.reduce((sum, item) => sum + (item.sets ?? 0), 0);
  const savedLabel = saveState === "saving" ? "Salvando…" : saveState === "saved" ? "Salvo automaticamente" : saveState === "error" ? "Não salvo" : "";

  return (
    <div className={styles.editor}>
      <div className={styles.top}>
        <Link href={api.listHref} className={styles.back} onClick={() => void flush().catch(() => {})}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          Treinos
        </Link>
        <span className={saveState === "error" ? `${styles.saved} ${styles.savedError}` : styles.saved} role="status">
          {savedLabel}
        </span>
      </div>

      <input
        ref={titleRef}
        className={styles.title}
        value={name}
        onChange={(event) => onNameChange(event.target.value)}
        placeholder="Nome do treino"
        aria-label="Nome do treino"
        maxLength={120}
      />
      {status === "ARQUIVADO" ? <p className={styles.archived}>Este treino está arquivado.</p> : null}

      <div className={styles.section}>
        <ChipGroup
          label="Dias sugeridos"
          showLabel
          multiple
          value={days}
          onChange={onDaysChange}
          options={WEEKDAYS.map((day) => ({ value: day.key, label: day.short }))}
        />
      </div>

      {error ? (
        <div className={styles.section}>
          <FormAlert>{error}</FormAlert>
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Comece pelos exercícios</p>
          <p className={styles.emptyText}>Escolha vários de uma vez. {`Entram com ${prescription.sets} séries de ${prescription.reps} e ${prescription.restSeconds} s de descanso. Você ajusta depois.`}</p>
          <Button type="button" block onClick={() => setLibraryOpen(true)}>
            Escolher na biblioteca
          </Button>
        </div>
      ) : (
        <>
          <div className={styles.listHeader}>
            <h2 className={styles.listTitle}>{items.length === 1 ? "1 exercício" : `${items.length} exercícios`}</h2>
            <span className={styles.listMeta}>
              {totalSets} séries · ~{Math.max(10, Math.round(totalSets * 2.2))} min
            </span>
          </div>
          <ol className={styles.list}>
            {items.map((item, index) => (
              <WorkoutItemCard
                key={item.id}
                item={item}
                index={index}
                isFirst={index === 0}
                isLast={index === items.length - 1}
                onChange={(patch) => onItemChange(item.id, patch)}
                onMove={(direction) => void onMove(index, direction)}
                onRemove={() => void onRemove(item.id)}
                onSwap={workoutId ? () => void openSwap(item) : undefined}
              />
            ))}
          </ol>
        </>
      )}

      {workoutId && renderActions ? <div className={styles.actions}>{renderActions({ id: workoutId, status })}</div> : null}

      <div className={styles.bar}>
        <Button type="button" variant="secondary" onClick={() => setLibraryOpen(true)}>
          + Exercícios
        </Button>
        <Button type="button" onClick={() => void onDone()} disabled={items.length === 0 || saveState === "saving"}>
          Pronto
        </Button>
      </div>

      {libraryOpen ? (
        <ExerciseLibrary
          exercises={library}
          alreadyInWorkout={items.map((item) => item.exerciseId)}
          onClose={() => setLibraryOpen(false)}
          onAdd={onAdd}
          adding={adding}
          createExerciseHref={createExerciseHref}
          prescription={prescription}
        />
      ) : null}

      <Sheet open={swapItem !== null} onClose={() => setSwapItem(null)} title={swapItem ? `Trocar ${swapItem.name}` : ""} description={swapItem ? (swapItem.intensity ? "Outros aeróbicos" : `Outros de ${swapItem.muscle ?? "mesmo grupo"}. Séries e repetições continuam.`) : undefined}>
        {swapOptions === null ? (
          <p className={styles.swapMuted}>Carregando…</p>
        ) : swapOptions.length === 0 ? (
          <p className={styles.swapMuted}>Nenhuma alternativa no catálogo.</p>
        ) : (
          <ul className={styles.tiles}>
            {swapOptions.map((option) => (
              <li key={option.id}>
                <button type="button" className={styles.tile} onClick={() => void swapTo(option)}>
                  {swapItem?.intensity && !option.imageUrl ? <CardioIcon size={64} /> : <ExerciseThumbnail src={option.imageUrl} alt="" width={160} height={110} className={styles.tileImage} />}
                  <span className={styles.tileName}>{option.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Sheet>

      <Sheet open={doneOpen} onClose={() => setDoneOpen(false)} title="Treino pronto" description={`${name.trim() || DEFAULT_NAME} · ${items.length} ${items.length === 1 ? "exercício" : "exercícios"} · ${formatDays(days)}. E agora?`}>
        {workoutId ? renderDone({ id: workoutId, name: name.trim() || DEFAULT_NAME, summary: formatDays(days) }, () => setDoneOpen(false)) : null}
      </Sheet>
    </div>
  );
}
