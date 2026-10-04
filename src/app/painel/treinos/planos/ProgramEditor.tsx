"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, ExerciseThumbnail, FormAlert, Sheet, Stepper, WeekStrip, useToast } from "@/shared/ui";
import { formatDays, weekStripFromDays } from "@/shared/lib/weekdays";
import { requestJson } from "../../_workout-builder/apiClient";
import styles from "./ProgramEditor.module.css";

export interface ProgramWorkout {
  id: string;
  name: string;
  suggestedDays: string[];
  exerciseCount: number;
  thumbnail: string | null;
}

export interface AvailableWorkout {
  id: string;
  name: string;
  exerciseCount: number;
  /// Programa onde já está (o treino será copiado); `null` = Meus modelos (será movido).
  inProgramName: string | null;
}

export interface AssignableStudentOption {
  id: string;
  displayName: string;
  activePlanName: string | null;
}

interface ProgramEditorProps {
  initial: { id: string; name: string; durationWeeks: number | null; status: "ATIVO" | "ARQUIVADO" } | null;
  workouts: ProgramWorkout[];
  available: AvailableWorkout[];
  students: AssignableStudentOption[];
}

const DEFAULT_NAME = "Novo programa";
const DEFAULT_WEEKS = 8;

/// Programa sem formulário (FIT-146, Momento 1 — estrutura de dados atual):
/// nome no título e vigência com +/−, salvos sozinhos; a semana é montada
/// pelos dias sugeridos de cada treino; adicionar treino em sheet;
/// atribuir a vários alunos de uma vez (BK-03). O programa dia a dia fica
/// para o EPIC-25.
export function ProgramEditor({ initial, workouts: initialWorkouts, available, students }: ProgramEditorProps) {
  const router = useRouter();
  const toast = useToast();
  const [planId, setPlanId] = useState<string | null>(initial?.id ?? null);
  const [name, setName] = useState(initial?.name ?? "");
  const [weeks, setWeeks] = useState(initial?.durationWeeks ?? DEFAULT_WEEKS);
  const [workouts, setWorkouts] = useState(initialWorkouts);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(initial ? "saved" : "idle");
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const creating = useRef<Promise<string> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  // Depois de `router.refresh()`, a lista do servidor substitui a local.
  const [syncedFrom, setSyncedFrom] = useState(initialWorkouts);
  if (syncedFrom !== initialWorkouts) {
    setSyncedFrom(initialWorkouts);
    setWorkouts(initialWorkouts);
  }

  useEffect(() => {
    if (!initial) titleRef.current?.focus();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [initial]);

  const ensurePlan = useCallback(async (): Promise<string> => {
    if (planId) return planId;
    if (!creating.current) {
      creating.current = (async () => {
        const created = await requestJson<{ id: string }>("/api/training-plans", {
          method: "POST",
          body: JSON.stringify({ name: name.trim() || DEFAULT_NAME, durationWeeks: weeks }),
        });
        setPlanId(created.id);
        window.history.replaceState(null, "", `/painel/treinos/planos/${created.id}`);
        return created.id;
      })();
    }
    return creating.current;
  }, [name, planId, weeks]);

  function save(body: { name?: string; durationWeeks?: number }) {
    setSaveState("saving");
    setError(null);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const id = await ensurePlan();
        await requestJson(`/api/training-plans/${id}`, { method: "PATCH", body: JSON.stringify(body) });
        setSaveState("saved");
      } catch (cause) {
        setSaveState("error");
        setError(cause instanceof Error ? cause.message : "Não foi possível salvar.");
      }
    }, 450);
  }

  async function addWorkout(workoutId: string) {
    setBusy(true);
    try {
      const id = await ensurePlan();
      const result = await requestJson<{ copied: boolean }>(`/api/training-plans/${id}/modelos`, { method: "POST", body: JSON.stringify({ workoutId }) });
      toast.show(result.copied ? "Uma cópia do treino entrou no programa" : "Treino adicionado");
      setAddOpen(false);
      router.refresh();
    } catch (cause) {
      toast.show(cause instanceof Error ? cause.message : "Não foi possível adicionar.");
    } finally {
      setBusy(false);
    }
  }

  async function newWorkout() {
    const id = await ensurePlan();
    router.push(`/painel/treinos/novo?programa=${id}`);
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (!planId || target < 0 || target >= workouts.length) return;
    const next = [...workouts];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setWorkouts(next);
    try {
      await requestJson(`/api/training-plans/${planId}/modelos/reordenar`, { method: "POST", body: JSON.stringify({ orderedWorkoutIds: next.map((w) => w.id) }) });
    } catch (cause) {
      setWorkouts(workouts);
      toast.show(cause instanceof Error ? cause.message : "Não foi possível reordenar.");
    }
  }

  async function remove(workout: ProgramWorkout) {
    if (!planId) return;
    try {
      await requestJson(`/api/training-plans/${planId}/modelos/${workout.id}`, { method: "DELETE" });
      setWorkouts((current) => current.filter((w) => w.id !== workout.id));
      toast.show(`${workout.name} voltou para Meus modelos`);
      router.refresh();
    } catch (cause) {
      toast.show(cause instanceof Error ? cause.message : "Não foi possível remover.");
    }
  }

  async function assign() {
    if (!planId) return;
    setBusy(true);
    try {
      const result = await requestJson<{ count: number }>(`/api/training-plans/${planId}/atribuir`, { method: "POST", body: JSON.stringify({ studentIds: selected }) });
      toast.show(`${name.trim() || DEFAULT_NAME} atribuído a ${result.count} ${result.count === 1 ? "aluno" : "alunos"}`);
      setAssignOpen(false);
      setSelected([]);
      router.refresh();
    } catch (cause) {
      toast.show(cause instanceof Error ? cause.message : "Não foi possível atribuir.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleLifecycle() {
    if (!planId || !initial) return;
    const action = initial.status === "ATIVO" ? "arquivar" : "reativar";
    try {
      await requestJson(`/api/training-plans/${planId}/${action}`, { method: "POST" });
      toast.show(initial.status === "ATIVO" ? "Programa arquivado" : "Programa reativado");
      router.push("/painel/treinos/planos");
      router.refresh();
    } catch (cause) {
      toast.show(cause instanceof Error ? cause.message : "Não foi possível concluir.");
    }
  }

  const allDays = [...new Set(workouts.flatMap((w) => w.suggestedDays))];
  const replacing = students.filter((s) => selected.includes(s.id) && s.activePlanName);
  const savedLabel = saveState === "saving" ? "Salvando…" : saveState === "saved" ? "Salvo automaticamente" : saveState === "error" ? "Não salvo" : "";

  return (
    <div className={styles.editor}>
      <div className={styles.top}>
        <Link href="/painel/treinos/planos" className={styles.back}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          Programas
        </Link>
        <span className={styles.saved} role="status">
          {savedLabel}
        </span>
      </div>

      <input
        ref={titleRef}
        className={styles.title}
        value={name}
        placeholder="Nome do programa"
        aria-label="Nome do programa"
        maxLength={120}
        onChange={(event) => {
          setName(event.target.value);
          if (event.target.value.trim()) save({ name: event.target.value.trim() });
        }}
      />
      {initial?.status === "ARQUIVADO" ? <p className={styles.archived}>Este programa está arquivado.</p> : null}

      <div className={styles.weeks}>
        <div>
          <span className={styles.label}>Vigência sugerida</span>
          <span className={styles.weeksValue}>{weeks} semanas</span>
        </div>
        <div className={styles.weeksStepper}>
          <Stepper
            label="Semanas"
            hideLabel
            value={weeks}
            min={1}
            max={52}
            onChange={(value) => {
              setWeeks(value);
              save({ durationWeeks: value });
            }}
          />
        </div>
      </div>

      {error ? <FormAlert>{error}</FormAlert> : null}

      <div className={styles.header}>
        <h2 className={styles.h2}>A semana</h2>
        <span className={styles.meta}>
          {allDays.length} {allDays.length === 1 ? "dia" : "dias"} de treino
        </span>
      </div>
      <WeekStrip days={weekStripFromDays(allDays)} label="Dias de treino do programa" />

      <div className={styles.header}>
        <h2 className={styles.h2}>Treinos do programa</h2>
      </div>
      {workouts.length === 0 ? <p className={styles.meta}>Nenhum treino ainda. Adicione um treino pronto ou monte um novo.</p> : null}
      <ol className={styles.list}>
        {workouts.map((workout, index) => (
          <li key={workout.id} className={styles.row}>
            <ExerciseThumbnail src={workout.thumbnail} alt="" width={48} height={48} className={styles.thumb} />
            <div className={styles.rowText}>
              <Link href={`/painel/treinos/${workout.id}`} className={styles.rowName}>
                {workout.name}
              </Link>
              <span className={styles.meta}>
                {workout.exerciseCount} {workout.exerciseCount === 1 ? "exercício" : "exercícios"} · {formatDays(workout.suggestedDays)}
              </span>
            </div>
            <div className={styles.rowActions}>
              <button type="button" className={styles.icon} onClick={() => void move(index, -1)} disabled={index === 0} aria-label={`Mover ${workout.name} para cima`}>
                ↑
              </button>
              <button type="button" className={styles.icon} onClick={() => void move(index, 1)} disabled={index === workouts.length - 1} aria-label={`Mover ${workout.name} para baixo`}>
                ↓
              </button>
              <button type="button" className={styles.icon} onClick={() => void remove(workout)} aria-label={`Tirar ${workout.name} do programa`}>
                ×
              </button>
            </div>
          </li>
        ))}
      </ol>
      <div className={styles.addRow}>
        <Button type="button" variant="secondary" block onClick={() => setAddOpen(true)}>
          + Adicionar treino
        </Button>
        <Button type="button" variant="quiet" onClick={() => void newWorkout()}>
          Montar um treino novo para este programa
        </Button>
      </div>

      {initial ? (
        <Button type="button" variant="quiet" onClick={() => void toggleLifecycle()}>
          {initial.status === "ATIVO" ? "Arquivar programa" : "Reativar programa"}
        </Button>
      ) : null}

      <div className={styles.bar}>
        <Button type="button" block size="lg" disabled={workouts.length === 0} onClick={() => setAssignOpen(true)}>
          Atribuir a alunos
        </Button>
      </div>

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Adicionar treino" description="Treinos de Meus modelos vêm para cá; treinos de outro programa entram como cópia.">
        <div className={styles.options}>
          {available.length === 0 ? <p className={styles.meta}>Nenhum outro treino ativo.</p> : null}
          {available.map((workout) => (
            <button key={workout.id} type="button" className={styles.option} disabled={busy} onClick={() => void addWorkout(workout.id)}>
              <span className={styles.rowName}>{workout.name}</span>
              <span className={styles.meta}>
                {workout.exerciseCount} {workout.exerciseCount === 1 ? "exercício" : "exercícios"}
                {workout.inProgramName ? ` · cópia de ${workout.inProgramName}` : ""}
              </span>
            </button>
          ))}
          <Button type="button" variant="secondary" block onClick={() => void newWorkout()}>
            + Montar um treino novo
          </Button>
        </div>
      </Sheet>

      <Sheet
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        title="Para quem?"
        description={name.trim() || DEFAULT_NAME}
        footer={
          <>
            <Button type="button" block disabled={selected.length === 0 || busy} onClick={() => void assign()}>
              {selected.length === 0 ? "Escolha ao menos um aluno" : `Atribuir a ${selected.length} ${selected.length === 1 ? "aluno" : "alunos"}`}
            </Button>
            <Button type="button" variant="quiet" block onClick={() => setAssignOpen(false)}>
              Agora não
            </Button>
          </>
        }
      >
        <div className={styles.options} role="group" aria-label="Alunos">
          {students.length === 0 ? <p className={styles.meta}>Nenhum aluno ativo ainda.</p> : null}
          {students.map((student) => {
            const isSelected = selected.includes(student.id);
            return (
              <button
                key={student.id}
                type="button"
                aria-pressed={isSelected}
                className={isSelected ? `${styles.option} ${styles.optionOn}` : styles.option}
                onClick={() => setSelected((current) => (isSelected ? current.filter((id) => id !== student.id) : [...current, student.id]))}
              >
                <span className={styles.rowName}>{student.displayName}</span>
                <span className={styles.meta}>{student.activePlanName ? `Hoje: ${student.activePlanName} (será substituído)` : "Sem programa ativo"}</span>
              </button>
            );
          })}
        </div>
        <p className={styles.hint}>
          Cada aluno recebe a própria cópia. Mudar o programa depois não altera o que já foi atribuído.
          {replacing.length > 0 ? ` ${replacing.length} ${replacing.length === 1 ? "aluno terá" : "alunos terão"} o programa atual substituído.` : ""}
        </p>
      </Sheet>
    </div>
  );
}
