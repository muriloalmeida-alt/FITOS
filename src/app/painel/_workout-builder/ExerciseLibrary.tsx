"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button, ChipGroup, ExerciseThumbnail } from "@/shared/ui";
import type { LibraryExercise } from "./types";
import styles from "./ExerciseLibrary.module.css";

interface ExerciseLibraryProps {
  exercises: LibraryExercise[];
  /// Exercícios que já estão no treino (marcados "Já está no treino").
  alreadyInWorkout: string[];
  onClose: () => void;
  onAdd: (exerciseIds: string[]) => Promise<void> | void;
  adding?: boolean;
  /// Destino de "Cadastrar exercício próprio" (null no FitOS Livre sem catálogo próprio).
  createExerciseHref?: string | null;
  /// Prescrição com que os exercícios entram (padrão do espaço, EPIC-36).
  prescription?: { sets: number; reps: number; restSeconds: number };
  /// Treino avulso: músculos do foco escolhido; a biblioteca abre no filtro "Seu foco".
  focusMuscles?: string[];
}

const ALL = "__todos__";
const FOCUS = "__foco__";

function normalize(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/// Biblioteca em tela cheia (FIT-146): busca, filtro por músculo e seleção
/// de vários exercícios de uma vez. "Adicionar N" usa a prescrição padrão
/// (3 × 12, 60 s). Diálogo modal com Esc para fechar.
export function ExerciseLibrary({ exercises, alreadyInWorkout, onClose, onAdd, adding = false, createExerciseHref, prescription = { sets: 3, reps: 12, restSeconds: 60 }, focusMuscles = [] }: ExerciseLibraryProps) {
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState<string>(focusMuscles.length > 0 ? FOCUS : ALL);
  const [selected, setSelected] = useState<string[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const muscles = useMemo(() => {
    const counts = new Map<string, number>();
    for (const exercise of exercises) {
      if (exercise.muscle) counts.set(exercise.muscle, (counts.get(exercise.muscle) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  }, [exercises]);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    const inFilter = (value: string | null) => muscle === ALL || (muscle === FOCUS ? value !== null && focusMuscles.includes(value) : value === muscle);
    return exercises.filter((exercise) => inFilter(exercise.muscle) && (!q || normalize(exercise.name).includes(q)));
  }, [exercises, muscle, query, focusMuscles]);

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  const count = selected.length;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="biblioteca-titulo">
      <div className={styles.top}>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Fechar biblioteca">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
        <span className={styles.selectedInfo} aria-live="polite">
          {count === 0 ? "Nenhum selecionado" : count === 1 ? "1 selecionado" : `${count} selecionados`}
        </span>
      </div>
      <div className={styles.scroll}>
        <p className={styles.eyebrow}>Biblioteca</p>
        <h2 id="biblioteca-titulo" className={styles.title}>
          Toque para escolher
        </h2>
        <label className={styles.search}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar exercício" aria-label="Buscar exercício" />
        </label>
        <div className={styles.filters}>
          <ChipGroup
            label="Filtrar por músculo"
            variant="scroll"
            tone="light"
            value={muscle}
            onChange={setMuscle}
            options={[...(focusMuscles.length > 0 ? [{ value: FOCUS, label: "Seu foco" }] : []), { value: ALL, label: "Todos" }, ...muscles.map((name) => ({ value: name, label: name }))]}
          />
        </div>
        {filtered.length === 0 ? <p className={styles.empty}>Nenhum exercício com esse nome ou filtro.</p> : null}
        <ul className={styles.list}>
          {filtered.map((exercise) => {
            const isSelected = selected.includes(exercise.id);
            const already = alreadyInWorkout.includes(exercise.id);
            return (
              <li key={exercise.id}>
                <button type="button" className={isSelected ? `${styles.option} ${styles.selected}` : styles.option} aria-pressed={isSelected} onClick={() => toggle(exercise.id)}>
                  <ExerciseThumbnail src={exercise.imageUrl} alt={exercise.imageAlt ?? ""} width={72} height={72} className={styles.thumb} />
                  <span className={styles.text}>
                    <span className={styles.name}>{exercise.name}</span>
                    {exercise.muscle ? <span className={styles.muscle}>{exercise.muscle}</span> : null}
                    {already ? <span className={styles.already}>Já está no treino</span> : null}
                  </span>
                  <span className={isSelected ? `${styles.check} ${styles.checkOn}` : styles.check} aria-hidden="true">
                    {isSelected ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                        <path d="m5 12 5 5 9-10" />
                      </svg>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {createExerciseHref ? (
          <Link href={createExerciseHref} className={styles.createLink}>
            Não achou? Cadastrar exercício próprio
          </Link>
        ) : null}
      </div>
      <div className={styles.bar}>
        <Button type="button" block size="lg" disabled={count === 0 || adding} onClick={() => onAdd(selected)}>
          {adding ? "Adicionando…" : count === 0 ? "Escolha um ou mais" : `Adicionar ${count === 1 ? "1 exercício" : `${count} exercícios`}`}
        </Button>
        <p className={styles.hint}>{`Entram com ${prescription.sets} × ${prescription.reps} e ${prescription.restSeconds} s de descanso`}</p>
      </div>
    </div>
  );
}
