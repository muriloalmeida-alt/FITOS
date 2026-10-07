"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Button,
  CardioIcon,
  ExerciseThumbnail,
  Sheet,
  useToast,
} from "@/shared/ui";
import { requestJson } from "../_workout-builder/apiClient";
import { ExerciseLibrary } from "../_workout-builder/ExerciseLibrary";
import type { LibraryExercise } from "../_workout-builder/types";
import { prescriptionLine } from "@/shared/lib/prescription";
import { formatClock } from "./clock";
import { shareWorkoutImage } from "./shareImage";
import type { CardioIntensity } from "@/shared/lib/cardio";
import { CardioRunner, cardioPosition } from "./CardioRunner";
import { cardioPhases } from "@/shared/lib/cardio";
import { AskCoach } from "./AskCoach";
import { WorkoutComment } from "./WorkoutComment";
import { fitToMinutes, shortOptions, workoutMinutes } from "./shortWorkout";
import styles from "./LiveWorkout.module.css";

export interface LiveSet {
  setNumber: number;
  reps: number | null;
  durationSeconds: number | null;
  loadKg: number | null;
}

export interface LiveItem {
  id: string;
  /// Exercício do treino (para buscar alternativas).
  exerciseId: string;
  /// "Aparelho ocupado" (EPIC-38): trocado só nesta sessão.
  performedExerciseId?: string | null;
  /// Nome do exercício do treino quando foi trocado.
  plannedName?: string | null;
  name: string;
  imageUrl: string | null;
  imageAlt: string | null;
  instructions: string | null;
  sets: number | null;
  reps: number | null;
  durationSeconds: number | null;
  /// Carga prescrita em kg (`null` quando livre ou texto sem número).
  loadKg: number | null;
  load: string | null;
  restSeconds: number | null;
  notes: string | null;
  /// Aeróbico (EPIC-28): tempo e intensidade, uma "série" só.
  intensity: CardioIntensity | null;
  doneSets: LiveSet[];
  /// BK-12: "Última vez".
  last: {
    loadKg: number | null;
    reps: number | null;
    durationSeconds: number | null;
  } | null;
}

export interface LiveWorkoutProps {
  /// `null`: ainda não começou (tela de preparação).
  sessionId: string | null;
  workoutId: string;
  workoutName: string;
  startedAt: string | null;
  items: LiveItem[];
  /// Quem prescreveu (nota do personal); `null` no FitOS Livre.
  coachName: string | null;
  /// `/api/workout-sessions` (aluno) ou `/api/minhas-sessoes` (Livre).
  apiBase: string;
  exitHref: string;
  progressHref: string;
  /// "Concluir" no resumo (padrão: `exitHref`). O Livre vai para Minha evolução.
  doneHref?: string;
  /// "Perguntar ao personal" (EPIC-39): só o aluno com personal.
  askCoach?: boolean;
  /// Treino avulso (FitOS Livre): começa vazio e o praticante inclui os
  /// exercícios da biblioteca durante o treino.
  free?: { library: LibraryExercise[] };
}

interface Summary {
  activeSeconds: number;
  sets: number;
  volumeKg: number;
  records: { exerciseName: string; loadKg: number }[];
}

type Phase = "ready" | "run" | "done";
type SheetKind = null | "how" | "list" | "music" | "end" | "busy";

const PREFS_KEY = "fitos:treino:prefs";
const CLOCK_PREFIX = "fitos:sessao:";
const LOAD_STEP = 2.5;
const DEFAULT_REST = 60;
const EFFORT = ["Leve", "Tranquilo", "Moderado", "Puxado", "No limite"];
const MUSIC_APPS = [
  { name: "Spotify", href: "https://open.spotify.com" },
  { name: "Apple Music", href: "https://music.apple.com" },
  { name: "YouTube Music", href: "https://music.youtube.com" },
];

/// Lugar do exercício atual enquanto o treino avulso ainda está vazio.
const NO_ITEM: LiveItem = {
  id: "",
  exerciseId: "",
  name: "",
  imageUrl: null,
  imageAlt: null,
  instructions: null,
  sets: null,
  reps: null,
  durationSeconds: null,
  loadKg: null,
  load: null,
  restSeconds: null,
  notes: null,
  intensity: null,
  doneSets: [],
  last: null,
};

interface Clock {
  accumulatedMs: number;
  runningSince: number | null;
}

function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Armazenamento indisponível: segue em memória.
  }
}

function elapsed(clock: Clock, now: number) {
  return (
    clock.accumulatedMs +
    (clock.runningSince !== null ? Math.max(0, now - clock.runningSince) : 0)
  );
}

function kg(value: number) {
  return String(Math.round(value * 10) / 10).replace(".", ",");
}

function totalSets(item: LiveItem) {
  if (item.intensity) return 1;
  return item.sets && item.sets > 0 ? item.sets : 1;
}

function isTimed(item: LiveItem) {
  return (
    !item.intensity &&
    item.durationSeconds !== null &&
    item.durationSeconds > 0 &&
    !item.reps
  );
}

function phaseLabel(item: LiveItem, index: number): string {
  if (!item.intensity) return "";
  return (
    cardioPhases(item.durationSeconds ?? 0, item.intensity)[index]?.label ?? ""
  );
}

function instructionSteps(text: string | null): string[] {
  if (!text) return [];
  const lines = text
    .split(/\n+|(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/)
    .map((line) => line.replace(/^\s*\d+[.)-]\s*/, "").trim());
  return lines.filter(Boolean).slice(0, 6);
}

/// Treino ao vivo (FIT-153, A3 do protótipo): preparação, execução com uma
/// mão (carga e repetições grandes, "Série feita" de 84 px), descanso em
/// tela cheia com bipes, vibração e voz, exercício por tempo, lista para
/// trocar a ordem ou pular, música por atalho (decisão D1) e resumo com
/// esforço e imagem para compartilhar. Grava cada série (BK-11).
export function LiveWorkout(props: LiveWorkoutProps) {
  const router = useRouter();
  const toast = useToast();
  const [sessionId, setSessionId] = useState(props.sessionId);
  const [phase, setPhase] = useState<Phase>(props.sessionId ? "run" : "ready");
  const [items, setItems] = useState(props.items);
  const [order, setOrder] = useState(() =>
    props.items.map((_, index) => index),
  );
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  /// "Só tenho X min" (EPIC-38): versão menor escolhida na preparação.
  const [short, setShort] = useState<{ minutes: number; note: string } | null>(null);
  /// "Aparelho ocupado" (EPIC-38): alternativas do exercício atual.
  const [alternatives, setAlternatives] = useState<{ id: string; name: string; imageUrl: string | null; imageAlt: string | null }[] | null>(null);
  const firstOpen = props.items.findIndex(
    (item) => item.doneSets.length < totalSets(item),
  );
  const [current, setCurrent] = useState(firstOpen >= 0 ? firstOpen : 0);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [busy, setBusy] = useState(false);
  const [voice, setVoice] = useState(true);
  const [awake, setAwake] = useState(true);
  const [clock, setClock] = useState<Clock>({
    accumulatedMs: 0,
    runningSince: null,
  });
  const [now, setNow] = useState(() => Date.now());
  const [rest, setRest] = useState<{ endsAt: number; total: number } | null>(
    null,
  );
  const [timer, setTimer] = useState<{
    endsAt: number | null;
    remaining: number;
  } | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [effort, setEffort] = useState<number | null>(null);
  const [draft, setDraft] = useState<{ loadKg: number; reps: number }>({
    loadKg: 0,
    reps: 0,
  });
  const [cardioClock, setCardioClock] = useState<Clock>({
    accumulatedMs: 0,
    runningSince: null,
  });
  const lastCardioPhaseRef = useRef<number>(-1);
  const audioRef = useRef<AudioContext | null>(null);
  const wakeRef = useRef<{ release: () => Promise<void> } | null>(null);
  const lastBeepRef = useRef<number>(-1);

  const item = items[current] ?? NO_ITEM;
  const free = props.free ?? null;
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [saveName, setSaveName] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const doneSetsCount = items.reduce((sum, entry) => sum + entry.doneSets.length, 0);
  const timed = isTimed(item);
  const cardio = item.intensity !== null && item.intensity !== undefined;
  const cardioElapsed = Math.floor(elapsed(cardioClock, now) / 1000);
  const cardioPhaseIndex = cardio
    ? cardioPosition(item.durationSeconds ?? 0, item.intensity!, cardioElapsed)
        .index
    : -1;
  const done = item.doneSets.length;
  const setNumber = Math.min(done + 1, totalSets(item));
  const allDone = items.every(
    (entry) =>
      skipped.has(entry.id) || entry.doneSets.length >= totalSets(entry),
  );

  // Preferências e relógio persistidos neste aparelho.
  useEffect(() => {
    const prefs = readJson<{ voice: boolean; awake: boolean }>(PREFS_KEY);
    /* eslint-disable react-hooks/set-state-in-effect -- sincronização única com o armazenamento do navegador após a hidratação */
    if (prefs) {
      setVoice(prefs.voice);
      setAwake(prefs.awake);
    }
    if (props.sessionId) {
      const saved = readJson<Clock>(
        `${CLOCK_PREFIX}${props.sessionId}:relogio`,
      );
      setClock(
        saved ?? {
          accumulatedMs: Math.max(
            0,
            Date.now() - new Date(props.startedAt ?? Date.now()).getTime(),
          ),
          runningSince: Date.now(),
        },
      );
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [props.sessionId, props.startedAt]);

  useEffect(() => {
    writeJson(PREFS_KEY, { voice, awake });
  }, [voice, awake]);

  useEffect(() => {
    if (sessionId && phase === "run")
      writeJson(`${CLOCK_PREFIX}${sessionId}:relogio`, clock);
  }, [clock, sessionId, phase]);

  // Valores da série atual (EPIC-30): a última série feita agora, senão a
  // maior entre a prescrita e a da última vez (o aluno só confirma) e as
  // repetições prescritas.
  const lastDone = item.doneSets[item.doneSets.length - 1];
  const seedKey = `${item.id}:${done}`;
  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (seededFor !== seedKey) {
    setSeededFor(seedKey);
    setDraft({
      loadKg: lastDone?.loadKg ?? Math.max(item.loadKg ?? 0, item.last?.loadKg ?? 0),
      reps: lastDone?.reps ?? item.reps ?? item.last?.reps ?? 10,
    });
  }

  const beep = useCallback(
    (frequency: number, ms: number) => {
      if (!voice) return;
      try {
        const AudioCtor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!audioRef.current && AudioCtor) audioRef.current = new AudioCtor();
        const ctx = audioRef.current;
        if (!ctx) return;
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.frequency.value = frequency;
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          ctx.currentTime + ms / 1000,
        );
        oscillator.start();
        oscillator.stop(ctx.currentTime + ms / 1000);
      } catch {
        // Sem áudio no aparelho.
      }
    },
    [voice],
  );

  const say = useCallback(
    (text: string) => {
      if (!voice) return;
      try {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "pt-BR";
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      } catch {
        // Sem voz no aparelho.
      }
    },
    [voice],
  );

  const buzz = useCallback(() => {
    try {
      navigator.vibrate?.([200, 100, 200]);
    } catch {
      // Sem vibração.
    }
  }, []);

  // Tela sempre ligada durante o treino.
  useEffect(() => {
    if (phase !== "run" || !awake) return;
    let cancelled = false;
    const nav = navigator as Navigator & {
      wakeLock?: {
        request: (type: "screen") => Promise<{ release: () => Promise<void> }>;
      };
    };
    nav.wakeLock
      ?.request("screen")
      .then((lock) => {
        if (cancelled) void lock.release();
        else wakeRef.current = lock;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      void wakeRef.current?.release().catch(() => undefined);
      wakeRef.current = null;
    };
  }, [phase, awake]);

  // Um relógio só para cronômetro, descanso e exercício por tempo.
  useEffect(() => {
    if (phase !== "run") return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [phase]);

  const restLeft = rest
    ? Math.max(0, Math.ceil((rest.endsAt - now) / 1000))
    : 0;

  // Aeróbico: anuncia cada etapa nova (voz e bipe) enquanto o tempo corre.
  useEffect(() => {
    if (
      !cardio ||
      cardioClock.runningSince === null ||
      cardioPhaseIndex === lastCardioPhaseRef.current
    )
      return;
    lastCardioPhaseRef.current = cardioPhaseIndex;
    if (cardioPhaseIndex === 0 && cardioElapsed > 1) return;
    const phases = cardioPosition(
      item.durationSeconds ?? 0,
      item.intensity!,
      cardioElapsed,
    );
    if (phases.index >= 0) beep(cardioPhaseIndex > 0 ? 880 : 660, 250);
    say(
      phases.left > 0 ? phaseLabel(item, cardioPhaseIndex) : "Tempo cumprido",
    );
  }, [
    cardio,
    cardioClock.runningSince,
    cardioPhaseIndex,
    cardioElapsed,
    item,
    beep,
    say,
  ]);

  function toggleCardio() {
    setCardioClock((clock) =>
      clock.runningSince === null
        ? { ...clock, runningSince: Date.now() }
        : { accumulatedMs: elapsed(clock, Date.now()), runningSince: null },
    );
  }

  function skipCardioPhase() {
    if (!item.intensity) return;
    const position = cardioPosition(
      item.durationSeconds ?? 0,
      item.intensity,
      cardioElapsed,
    );
    setCardioClock((clock) => ({
      accumulatedMs: elapsed(clock, Date.now()) + position.left * 1000,
      runningSince: clock.runningSince === null ? null : Date.now(),
    }));
  }
  const timerLeft = timer
    ? timer.endsAt !== null
      ? Math.max(0, Math.ceil((timer.endsAt - now) / 1000))
      : timer.remaining
    : (item.durationSeconds ?? 0);

  useEffect(() => {
    const left = rest ? restLeft : timer?.endsAt ? timerLeft : null;
    if (left === null || left === lastBeepRef.current) return;
    lastBeepRef.current = left;
    if (left > 0 && left <= 3) beep(660, 120);
    if (left === 0) {
      beep(990, 400);
      buzz();
      if (rest) {
        say(`Descanso acabou. ${item.name}, série ${setNumber}.`);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- o fim do descanso é um evento do relógio
        setRest(null);
      } else {
        say("Tempo!");
        setTimer({ endsAt: null, remaining: 0 });
      }
    }
  }, [rest, restLeft, timer, timerLeft, beep, buzz, say, item.name, setNumber]);

  const activeMs = elapsed(clock, now);
  const paused = phase === "run" && clock.runningSince === null;

  function togglePause() {
    setClock((current) =>
      current.runningSince === null
        ? { ...current, runningSince: Date.now() }
        : { accumulatedMs: elapsed(current, Date.now()), runningSince: null },
    );
  }

  async function start() {
    setBusy(true);
    try {
      const session = await requestJson<{ id: string }>(props.apiBase, {
        method: "POST",
        body: JSON.stringify({ workoutId: props.workoutId }),
      });
      setSessionId(session.id);
      setClock({ accumulatedMs: 0, runningSince: Date.now() });
      setPhase("run");
      beep(880, 150);
      const first = items[current]!;
      say(`Bora! ${first.name}, ${totalSets(first)} séries.`);
    } catch (cause) {
      toast.show(
        cause instanceof Error ? cause.message : "Não foi possível começar.",
      );
    } finally {
      setBusy(false);
    }
  }

  function nextOpenIndex(from: number): number {
    const position = order.indexOf(from);
    for (let step = 1; step <= order.length; step += 1) {
      const index = order[(position + step) % order.length]!;
      const entry = items[index]!;
      if (!skipped.has(entry.id) && entry.doneSets.length < totalSets(entry))
        return index;
    }
    return -1;
  }

  async function finish() {
    if (!sessionId) return;
    setBusy(true);
    try {
      const result = await requestJson<{ summary: Summary }>(
        `${props.apiBase}/${sessionId}/concluir`,
        {
          method: "POST",
          body: JSON.stringify({
            activeSeconds: Math.round(elapsed(clock, Date.now()) / 1000),
          }),
        },
      );
      setSummary(result.summary);
      setRest(null);
      setSheet(null);
      setPhase("done");
      say("Treino concluído. Mandou bem!");
      try {
        window.localStorage.removeItem(`${CLOCK_PREFIX}${sessionId}:relogio`);
      } catch {
        // idem
      }
    } catch (cause) {
      toast.show(
        cause instanceof Error ? cause.message : "Não foi possível concluir.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function abandon() {
    if (!sessionId) return;
    setBusy(true);
    try {
      await requestJson(`${props.apiBase}/${sessionId}/abandonar`, {
        method: "POST",
      });
      router.push(props.exitHref);
      router.refresh();
    } catch (cause) {
      toast.show(
        cause instanceof Error ? cause.message : "Não foi possível encerrar.",
      );
      setBusy(false);
    }
  }

  async function completeSet() {
    if (!sessionId || busy) return;
    // Exercício por tempo: o tempo cronometrado (ou o prescrito, se o
    // cronômetro não foi usado).
    const timedSeconds = timer
      ? Math.max(
          1,
          (item.durationSeconds ?? 0) -
            (timer.endsAt ? timerLeft : timer.remaining),
        )
      : Math.max(1, item.durationSeconds ?? 1);
    const loadKg = draft.loadKg > 0 ? draft.loadKg : null;
    const cardioSeconds = Math.max(
      60,
      cardioElapsed > 0 ? cardioElapsed : (item.durationSeconds ?? 60),
    );
    const entry: LiveSet = cardio
      ? { setNumber, reps: null, durationSeconds: cardioSeconds, loadKg: null }
      : timed
        ? { setNumber, reps: null, durationSeconds: timedSeconds, loadKg }
        : { setNumber, reps: draft.reps, durationSeconds: null, loadKg };
    const before = items;
    const updated = items.map((candidate, index) =>
      index === current
        ? {
            ...candidate,
            doneSets: [
              ...candidate.doneSets.filter(
                (set) => set.setNumber !== setNumber,
              ),
              entry,
            ],
          }
        : candidate,
    );
    setItems(updated);
    setTimer(null);
    setCardioClock({ accumulatedMs: 0, runningSince: null });
    lastCardioPhaseRef.current = -1;
    setBusy(true);
    try {
      const result = await requestJson<{ personalRecord: boolean }>(
        `${props.apiBase}/${sessionId}/series`,
        {
          method: "POST",
          body: JSON.stringify({
            workoutExerciseId: item.id,
            setNumber,
            reps: entry.reps,
            durationSeconds: entry.durationSeconds,
            loadKg: entry.loadKg,
            performedExerciseId: item.performedExerciseId ?? null,
          }),
        },
      );
      if (result.personalRecord) {
        toast.show(`Novo recorde: ${kg(entry.loadKg ?? 0)} kg`);
        say("Novo recorde!");
      }
    } catch (cause) {
      setItems(before);
      toast.show(
        cause instanceof Error
          ? cause.message
          : "Não foi possível salvar a série.",
      );
      setBusy(false);
      return;
    }
    setBusy(false);

    const finishedHere = entry.setNumber >= totalSets(item);
    const remaining = updated.some(
      (candidate) =>
        !skipped.has(candidate.id) &&
        candidate.doneSets.length < totalSets(candidate),
    );
    if (!remaining) {
      setSheet("end");
      return;
    }
    if (finishedHere) {
      const next = (() => {
        const position = order.indexOf(current);
        for (let step = 1; step <= order.length; step += 1) {
          const index = order[(position + step) % order.length]!;
          const candidate = updated[index]!;
          if (
            !skipped.has(candidate.id) &&
            candidate.doneSets.length < totalSets(candidate)
          )
            return index;
        }
        return -1;
      })();
      if (next >= 0) setCurrent(next);
    }
    const restSeconds = cardio ? 0 : (item.restSeconds ?? DEFAULT_REST);
    if (restSeconds > 0) {
      lastBeepRef.current = -1;
      setRest({ endsAt: Date.now() + restSeconds * 1000, total: restSeconds });
    }
  }

  async function undoLastSet() {
    if (!sessionId || !lastDone || busy) return;
    const before = items;
    setItems(
      items.map((candidate, index) =>
        index === current
          ? { ...candidate, doneSets: candidate.doneSets.slice(0, -1) }
          : candidate,
      ),
    );
    try {
      await requestJson(`${props.apiBase}/${sessionId}/series`, {
        method: "DELETE",
        body: JSON.stringify({
          workoutExerciseId: item.id,
          setNumber: lastDone.setNumber,
        }),
      });
      toast.show(`Série ${lastDone.setNumber} desfeita`);
    } catch (cause) {
      setItems(before);
      toast.show(
        cause instanceof Error ? cause.message : "Não foi possível desfazer.",
      );
    }
  }

  function goTo(index: number) {
    setOrder((currentOrder) => {
      // Aparelho ocupado: o escolhido passa a ser o próximo da fila.
      const without = currentOrder.filter((value) => value !== index);
      const at = without.indexOf(current);
      return [...without.slice(0, at + 1), index, ...without.slice(at + 1)];
    });
    setCurrent(index);
    setTimer(null);
    setCardioClock({ accumulatedMs: 0, runningSince: null });
    lastCardioPhaseRef.current = -1;
    setSheet(null);
  }

  function skipCurrent() {
    const next = nextOpenIndex(current);
    setSkipped((currentSkipped) => new Set(currentSkipped).add(item.id));
    setTimer(null);
    setSheet(null);
    if (next >= 0 && next !== current) setCurrent(next);
    else setSheet("end");
  }

  function toggleTimer() {
    if (timer?.endsAt) {
      setTimer({ endsAt: null, remaining: timerLeft });
      return;
    }
    const remaining =
      timer && timer.remaining > 0
        ? timer.remaining
        : (item.durationSeconds ?? 30);
    lastBeepRef.current = -1;
    beep(880, 120);
    setTimer({ endsAt: Date.now() + remaining * 1000, remaining });
  }

  function openLibrary() {
    setSheet(null);
    setLibraryOpen(true);
  }

  /// Treino avulso: inclui os exercícios escolhidos e já vai para o primeiro.
  async function addExercises(exerciseIds: string[]) {
    if (!sessionId || exerciseIds.length === 0) return;
    setAdding(true);
    try {
      const result = await requestJson<{ items: LiveItem[] }>(`${props.apiBase}/${sessionId}/exercicios`, {
        method: "POST",
        body: JSON.stringify({ exerciseIds }),
      });
      const start = items.length;
      setItems([...items, ...result.items]);
      setOrder([...order, ...result.items.map((_, index) => start + index)]);
      setCurrent(start);
      setTimer(null);
      setCardioClock({ accumulatedMs: 0, runningSince: null });
      lastCardioPhaseRef.current = -1;
      setLibraryOpen(false);
      setSheet(null);
      const first = result.items[0];
      if (first) say(`${first.name}, ${totalSets(first)} séries.`);
    } catch (cause) {
      toast.show(cause instanceof Error ? cause.message : "Não foi possível incluir.");
    } finally {
      setAdding(false);
    }
  }

  async function saveWorkout() {
    if (!sessionId) return;
    setBusy(true);
    try {
      await requestJson(`${props.apiBase}/${sessionId}/salvar`, {
        method: "POST",
        body: JSON.stringify({ name: saveName ?? "" }),
      });
      setSaved(true);
      setSaveName(null);
      toast.show("Salvo em Meus treinos");
    } catch (cause) {
      toast.show(cause instanceof Error ? cause.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }

  async function rate(value: number) {
    setEffort(value);
    if (!sessionId) return;
    try {
      await requestJson(`${props.apiBase}/${sessionId}/esforco`, {
        method: "POST",
        body: JSON.stringify({ perceivedEffort: value }),
      });
      toast.show(
        props.coachName
          ? `${props.coachName.split(/\s+/)[0]} vai ver como foi`
          : "Anotado no seu histórico",
      );
    } catch (cause) {
      toast.show(
        cause instanceof Error ? cause.message : "Não foi possível enviar.",
      );
    }
  }

  const totalPlannedSets = useMemo(
    () => items.filter((entry) => !skipped.has(entry.id)).reduce((sum, entry) => sum + totalSets(entry), 0),
    [items, skipped],
  );
  const fullMinutes = useMemo(() => workoutMinutes(props.items), [props.items]);
  const timeOptions = useMemo(() => shortOptions(props.items), [props.items]);
  const visibleCount = items.filter((entry) => !skipped.has(entry.id)).length;

  function chooseTime(minutes: number | null) {
    if (minutes === null) {
      setItems(props.items);
      setSkipped(new Set());
      setShort(null);
      return;
    }
    const plan = fitToMinutes(props.items, minutes);
    const names = props.items.filter((entry) => plan.dropped.includes(entry.id)).map((entry) => entry.name);
    const note = [
      plan.setsCut ? "2 séries por exercício" : null,
      plan.cardioCut ? "aeróbico mais curto" : null,
      names.length > 0 ? `fica para outro dia: ${names.join(", ")}` : null,
    ].filter(Boolean).join(" · ");
    setItems(plan.items);
    setSkipped(new Set(plan.dropped));
    setShort({ minutes, note });
  }

  async function openBusy() {
    setSheet("busy");
    if (item.doneSets.length > 0) return;
    setAlternatives(null);
    const result = (await fetch(`/api/exercises/${item.exerciseId}/alternativas`).then((r) => (r.ok ? r.json() : null)).catch(() => null)) as { options?: { id: string; name: string; imageUrl: string | null; imageAlt: string | null }[] } | null;
    setAlternatives(result?.options ?? []);
  }

  function doLater() {
    const next = order.filter((index) => index !== current);
    const reordered = [...next, current];
    const target = next.find((index) => !skipped.has(items[index]!.id) && items[index]!.doneSets.length < totalSets(items[index]!));
    setOrder(reordered);
    setSheet(null);
    if (target !== undefined) {
      setCurrent(target);
      toast.show(`${item.name} fica para o fim`);
    }
  }

  function swapToday(option: { id: string; name: string; imageUrl: string | null; imageAlt: string | null } | null) {
    const original = props.items.find((entry) => entry.id === item.id)!;
    setItems(
      items.map((candidate, index) =>
        index !== current
          ? candidate
          : option
            ? { ...candidate, performedExerciseId: option.id, plannedName: original.name, name: option.name, imageUrl: option.imageUrl, imageAlt: option.imageAlt, instructions: null, last: null }
            : { ...candidate, performedExerciseId: null, plannedName: null, name: original.name, imageUrl: original.imageUrl, imageAlt: original.imageAlt, instructions: original.instructions, last: original.last },
      ),
    );
    setSheet(null);
    toast.show(option ? `Hoje: ${option.name}` : `De volta: ${original.name}`);
  }
  const estimatedMinutes = useMemo(() => workoutMinutes(items.filter((entry) => !skipped.has(entry.id))), [items, skipped]);
  const steps = instructionSteps(item.instructions);
  const nextForRest = (() => {
    if (done < totalSets(item))
      return `${item.name} · série ${setNumber} de ${totalSets(item)}`;
    const index = nextOpenIndex(current);
    return index >= 0 ? items[index]!.name : "Fim do treino";
  })();

  const others = order.some((index) => index !== current && !skipped.has(items[index]!.id) && items[index]!.doneSets.length < totalSets(items[index]!));
  const busySheet = (
    <Sheet open={sheet === "busy"} onClose={() => setSheet(null)} title="Aparelho ocupado?" description="Faça outro agora e volte depois, ou troque só hoje. Seu treino não muda.">
      <div className={styles.busyList}>
        {others ? (
          <Button type="button" variant="secondary" block onClick={doLater}>
            Fazer depois, volto no fim
          </Button>
        ) : null}
        {item.doneSets.length > 0 ? (
          <p className={styles.muted}>Você já fez séries deste exercício; dá para deixá-lo para o fim.</p>
        ) : (
          <>
            <p className={styles.cap}>Trocar só hoje por</p>
            {item.plannedName ? (
              <button type="button" className={styles.option} onClick={() => swapToday(null)}>
                <span>
                  <strong>{item.plannedName}</strong>
                  <span className={styles.muted}>Voltar ao do treino</span>
                </span>
              </button>
            ) : null}
            {alternatives === null ? <p className={styles.muted}>Buscando opções…</p> : alternatives.length === 0 ? <p className={styles.muted}>Sem outra opção do mesmo grupo no catálogo.</p> : null}
            {(alternatives ?? []).filter((option) => option.id !== item.performedExerciseId).map((option) => (
              <button key={option.id} type="button" className={styles.option} onClick={() => swapToday(option)}>
                <span className={styles.altRow}>
                  <ExerciseThumbnail src={option.imageUrl} alt={option.imageAlt ?? option.name} width={44} height={44} className={styles.altThumb} />
                  <strong>{option.name}</strong>
                </span>
              </button>
            ))}
          </>
        )}
      </div>
    </Sheet>
  );

  const musicSheet = (
    <Sheet
      open={sheet === "music"}
      onClose={() => setSheet(null)}
      title="Música"
      description="Abra seu app de música. Ele continua tocando enquanto você registra o treino aqui."
    >
      <div className={styles.musicGrid}>
        {MUSIC_APPS.map((app) => (
          <a
            key={app.name}
            href={app.href}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.musicApp}
          >
            {app.name}
          </a>
        ))}
      </div>
      <Button
        type="button"
        variant="secondary"
        block
        onClick={() => setSheet(null)}
      >
        Voltar ao treino
      </Button>
    </Sheet>
  );

  if (phase === "ready") {
    return (
      <div className={styles.screen}>
        <div className={styles.top}>
          <Link
            href={props.exitHref}
            className={styles.back}
            aria-label="Voltar"
          >
            ‹ Voltar
          </Link>
        </div>
        <div className={styles.scroll}>
          <p className={styles.eyebrow}>Pronto para treinar</p>
          <h1 className={styles.title}>{props.workoutName}</h1>
          <p className={styles.muted}>
            {visibleCount} {visibleCount === 1 ? "exercício" : "exercícios"} ·{" "}
            {totalPlannedSets} séries · cerca de {estimatedMinutes} min
          </p>
          {timeOptions.length > 0 ? (
            <>
              <p className={styles.cap}>Tempo hoje</p>
              <div className={styles.timeChips} role="radiogroup" aria-label="Tempo hoje">
                {[null, ...timeOptions].map((minutes) => (
                  <button
                    key={String(minutes)}
                    type="button"
                    role="radio"
                    aria-checked={(short?.minutes ?? null) === minutes}
                    className={(short?.minutes ?? null) === minutes ? `${styles.timeChip} ${styles.timeChipOn}` : styles.timeChip}
                    onClick={() => chooseTime(minutes)}
                  >
                    {minutes === null ? `Completo · ${fullMinutes} min` : `Só ${minutes} min`}
                  </button>
                ))}
              </div>
              {short ? <p className={styles.muted}>Versão de {short.minutes} min: {short.note}. Seu programa não muda.</p> : null}
            </>
          ) : null}
          <div className={styles.thumbs}>
            {items.slice(0, 5).map((entry) => (
              <ExerciseThumbnail
                key={entry.id}
                src={entry.imageUrl}
                alt={entry.imageAlt ?? entry.name}
                width={68}
                height={68}
                className={styles.thumb}
              />
            ))}
          </div>
          <p className={styles.cap}>Durante o treino</p>
          <button
            type="button"
            role="switch"
            aria-checked={voice}
            className={styles.option}
            onClick={() => setVoice(!voice)}
          >
            <span>
              <strong>Voz e bipes</strong>
              <span className={styles.muted}>
                Avisa o fim do descanso e a próxima série.
              </span>
            </span>
            <span
              className={
                voice ? `${styles.switch} ${styles.switchOn}` : styles.switch
              }
              aria-hidden="true"
            />
          </button>
          <button
            type="button"
            role="switch"
            aria-checked={awake}
            className={styles.option}
            onClick={() => setAwake(!awake)}
          >
            <span>
              <strong>Tela sempre ligada</strong>
              <span className={styles.muted}>
                A tela não apaga entre as séries.
              </span>
            </span>
            <span
              className={
                awake ? `${styles.switch} ${styles.switchOn}` : styles.switch
              }
              aria-hidden="true"
            />
          </button>
          <button
            type="button"
            className={styles.option}
            onClick={() => setSheet("music")}
          >
            <span>
              <strong>Música</strong>
              <span className={styles.muted}>
                Spotify, Apple Music ou YouTube Music.
              </span>
            </span>
            <span className={styles.link}>Escolher</span>
          </button>
        </div>
        <div className={styles.bar}>
          <button
            type="button"
            className={styles.startButton}
            disabled={busy}
            onClick={() => void start()}
          >
            {busy ? "Começando…" : "Começar treino"}
          </button>
        </div>
        {musicSheet}
      </div>
    );
  }

  if (phase === "done" && summary) {
    const minutes = Math.max(1, Math.round(summary.activeSeconds / 60));
    return (
      <div className={styles.screen}>
        <div className={styles.scroll}>
          <div className={styles.doneIcon} aria-hidden="true">
            ✓
          </div>
          <p className={styles.eyebrow}>Treino concluído</p>
          <h1 className={styles.title}>Mandou bem!</h1>
          <dl className={styles.stats}>
            <div>
              <dt>tempo ativo</dt>
              <dd>{minutes} min</dd>
            </div>
            <div>
              <dt>séries</dt>
              <dd>{summary.sets}</dd>
            </div>
            <div>
              <dt>kg no total</dt>
              <dd>{kg(summary.volumeKg)}</dd>
            </div>
          </dl>
          {summary.records.map((record) => (
            <p key={record.exerciseName} className={styles.record}>
              <span aria-hidden="true">★</span> Novo recorde ·{" "}
              {record.exerciseName}: {kg(record.loadKg)} kg
            </p>
          ))}
          <p className={styles.cap}>Como foi o treino?</p>
          <div
            className={styles.effort}
            role="radiogroup"
            aria-label="Como foi o treino?"
          >
            {EFFORT.map((label, index) => (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={effort === index + 1}
                className={
                  effort === index + 1
                    ? `${styles.effortOption} ${styles.effortOn}`
                    : styles.effortOption
                }
                onClick={() => void rate(index + 1)}
              >
                <strong>{index + 1}</strong>
                <span>{label}</span>
              </button>
            ))}
          </div>
          {props.askCoach && props.coachName && sessionId ? <WorkoutComment sessionId={sessionId} coachName={props.coachName} /> : null}
          {free ? (
            saved ? (
              <p className={styles.muted}>Salvo em Meus treinos. Dá para repetir outro dia.</p>
            ) : saveName === null ? (
              <Button type="button" variant="outlined" block onClick={() => setSaveName("")}>
                Salvar nos meus treinos
              </Button>
            ) : (
              <div className={styles.saveRow}>
                <label className={styles.cap} htmlFor="nome-treino-avulso">
                  Nome do treino
                </label>
                <input
                  id="nome-treino-avulso"
                  className={styles.saveInput}
                  value={saveName}
                  maxLength={80}
                  placeholder="Treino avulso"
                  onChange={(event) => setSaveName(event.target.value)}
                />
                <Button type="button" variant="secondary" block disabled={busy} onClick={() => void saveWorkout()}>
                  Salvar
                </Button>
              </div>
            )
          ) : null}
          <div className={styles.doneActions}>
            <Button
              type="button"
              variant="secondary"
              block
              onClick={() =>
                void shareWorkoutImage({
                  workoutName: props.workoutName,
                  minutes,
                  sets: summary.sets,
                  volumeKg: summary.volumeKg,
                  records: summary.records.length,
                }).then((outcome) => {
                  if (outcome === "downloaded") toast.show("Imagem salva");
                })
              }
            >
              Compartilhar
            </Button>
            <Button href={props.doneHref ?? props.exitHref} block>
              Concluir
            </Button>
          </div>
          <Link href={props.progressHref} className={styles.link}>
            Ver minha evolução →
          </Link>
        </div>
      </div>
    );
  }

  const library = free && libraryOpen ? (
    <ExerciseLibrary
      exercises={free.library}
      alreadyInWorkout={items.map((entry) => entry.exerciseId)}
      onClose={() => setLibraryOpen(false)}
      onAdd={addExercises}
      adding={adding}
      createExerciseHref={null}
    />
  ) : null;

  const endSheet = (
    <Sheet
      open={sheet === "end"}
      onClose={() => setSheet(null)}
      title={free && doneSetsCount === 0 ? "Sair do treino avulso?" : allDone ? (free ? "Exercícios feitos!" : "Treino completo!") : "Encerrar o treino agora?"}
      description={
        free && doneSetsCount === 0
          ? "Nenhuma série registrada; nada fica salvo."
          : allDone
            ? free
              ? "Vai fazer mais algum? Inclua e siga treinando."
              : "Todas as séries feitas."
            : `${doneSetsCount} de ${totalPlannedSets} séries feitas. O que você fez fica salvo.`
      }
    >
      <div className={styles.endActions}>
        {free ? (
          <Button type="button" variant="secondary" block onClick={openLibrary}>
            + Adicionar exercício
          </Button>
        ) : null}
        {free && doneSetsCount === 0 ? null : (
          <button
            type="button"
            className={styles.startButton}
            disabled={busy}
            onClick={() => void finish()}
          >
            {allDone ? "Concluir treino" : "Concluir com o que fiz"}
          </button>
        )}
        {allDone || (free && doneSetsCount === 0) ? null : (
          <Button
            type="button"
            variant="secondary"
            block
            onClick={() => setSheet(null)}
          >
            Continuar treinando
          </Button>
        )}
        {allDone && !(free && doneSetsCount === 0) ? null : (
          <button
            type="button"
            className={styles.danger}
            disabled={busy}
            onClick={() => void abandon()}
          >
            {free && doneSetsCount === 0 ? "Sair sem salvar" : "Abandonar treino"}
          </button>
        )}
      </div>
    </Sheet>
  );

  if (free && items.length === 0) {
    return (
      <div className={styles.screen}>
        <div className={styles.runTop}>
          <button type="button" className={styles.iconButton} aria-label="Encerrar treino" onClick={() => setSheet("end")}>
            ✕
          </button>
          <button
            type="button"
            className={paused ? `${styles.clock} ${styles.clockPaused}` : styles.clock}
            onClick={togglePause}
            aria-label={paused ? "Continuar cronômetro" : "Pausar cronômetro"}
          >
            <span aria-hidden="true">{paused ? "▶" : "❚❚"}</span> {formatClock(activeMs)}
          </button>
          <span className={styles.topRight} />
        </div>
        <div className={styles.scroll}>
          <p className={styles.eyebrow}>Treino avulso</p>
          <h1 className={styles.title}>O que você vai fazer agora?</h1>
          <p className={styles.muted}>Escolha o exercício na hora, conforme o tempo e o aparelho livre. Depois inclua o próximo.</p>
        </div>
        <div className={styles.bar}>
          <button type="button" className={styles.startButton} onClick={openLibrary}>
            Escolher exercício
          </button>
        </div>
        {endSheet}
        {library}
      </div>
    );
  }

  const dots = Array.from({ length: totalSets(item) }, (_, index) => index + 1);
  const restPercent = rest ? restLeft / rest.total : 0;
  const ring = 703.7;

  return (
    <div className={styles.screen}>
      <div className={styles.runTop}>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="Encerrar treino"
          onClick={() => setSheet("end")}
        >
          ✕
        </button>
        <button
          type="button"
          className={
            paused ? `${styles.clock} ${styles.clockPaused}` : styles.clock
          }
          onClick={togglePause}
          aria-label={paused ? "Continuar cronômetro" : "Pausar cronômetro"}
        >
          <span aria-hidden="true">{paused ? "▶" : "❚❚"}</span>{" "}
          {formatClock(activeMs)}
        </button>
        <div className={styles.topRight}>
          <button
            type="button"
            className={
              voice
                ? `${styles.iconButton} ${styles.iconOn}`
                : styles.iconButton
            }
            aria-label={voice ? "Desligar voz e bipes" : "Ligar voz e bipes"}
            aria-pressed={voice}
            onClick={() => setVoice(!voice)}
          >
            {voice ? "🔊" : "🔈"}
          </button>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Ver treino completo"
            onClick={() => setSheet("list")}
          >
            ☰
          </button>
        </div>
      </div>
      <div
        className={styles.segments}
        aria-label={`${items.filter((entry) => entry.doneSets.length >= totalSets(entry)).length} de ${items.length} exercícios concluídos`}
      >
        {order.map((index) => {
          const entry = items[index]!;
          const state =
            entry.doneSets.length >= totalSets(entry)
              ? styles.segDone
              : index === current
                ? styles.segNow
                : skipped.has(entry.id)
                  ? styles.segSkip
                  : "";
          return (
            <span key={entry.id} className={`${styles.segment} ${state}`} />
          );
        })}
      </div>

      <div className={styles.scroll}>
        {paused ? (
          <p className={styles.warn}>Pausado. Toque no tempo para continuar.</p>
        ) : null}
        <div className={styles.exercise}>
          <button
            type="button"
            className={styles.photo}
            onClick={() => setSheet("how")}
            aria-label={`Como fazer ${item.name}`}
          >
            {cardio ? (
              <CardioIcon size={118} />
            ) : (
              <ExerciseThumbnail
                src={item.imageUrl}
                alt=""
                width={118}
                height={118}
                className={styles.photoImg}
              />
            )}
            <span className={styles.photoTag}>Como fazer</span>
          </button>
          <div className={styles.exerciseText}>
            <p className={styles.eyebrow}>
              Exercício {order.indexOf(current) + 1} de {items.length}
            </p>
            <h1 className={styles.exerciseName}>{item.name}</h1>
            {item.plannedName ? <p className={styles.muted}>Hoje, no lugar de {item.plannedName}</p> : null}
            <p className={styles.muted}>{prescriptionLine(item)}</p>
            <span className={styles.exerciseLinks}>
              {free ? (
                <button type="button" className={styles.busyLink} onClick={openLibrary}>
                  + Adicionar exercício
                </button>
              ) : (
                <button type="button" className={styles.busyLink} onClick={() => void openBusy()}>
                  Aparelho ocupado?
                </button>
              )}
              {props.askCoach && props.coachName ? <AskCoach exerciseId={item.performedExerciseId ?? item.exerciseId} exerciseName={item.name} coachName={props.coachName} /> : null}
            </span>
          </div>
        </div>
        {item.notes ? (
          <p className={styles.note}>
            {props.coachName ? `${props.coachName.split(/\s+/)[0]}: ` : ""}
            {item.notes}
          </p>
        ) : null}

        {cardio ? (
          <CardioRunner
            durationSeconds={item.durationSeconds ?? 0}
            intensity={item.intensity!}
            elapsedSeconds={cardioElapsed}
            running={cardioClock.runningSince !== null}
            onToggle={toggleCardio}
            onSkipPhase={skipCardioPhase}
          />
        ) : (
          <>
            <div className={styles.setRow}>
              <ol
                className={styles.dots}
                aria-label={`${done} de ${totalSets(item)} séries feitas`}
              >
                {dots.map((number) => (
                  <li
                    key={number}
                    className={
                      number <= done
                        ? `${styles.dot} ${styles.dotDone}`
                        : number === setNumber
                          ? `${styles.dot} ${styles.dotNow}`
                          : styles.dot
                    }
                  >
                    {number <= done ? "✓" : number}
                  </li>
                ))}
              </ol>
              <span className={styles.muted}>
                Série <strong className={styles.setNumber}>{setNumber}</strong>
              </span>
            </div>

            <div className={styles.controls}>
              <div className={styles.control}>
                <span className={styles.label}>Carga</span>
                <span className={styles.value} aria-live="polite">
                  {draft.loadKg > 0 ? kg(draft.loadKg) : "Livre"}
                  {draft.loadKg > 0 ? <small> kg</small> : null}
                </span>
                <div className={styles.pair}>
                  <button
                    type="button"
                    className={styles.step}
                    aria-label="Diminuir carga"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        loadKg: Math.max(0, draft.loadKg - LOAD_STEP),
                      })
                    }
                  >
                    −
                  </button>
                  <button
                    type="button"
                    className={styles.step}
                    aria-label="Aumentar carga"
                    onClick={() =>
                      setDraft({ ...draft, loadKg: draft.loadKg + LOAD_STEP })
                    }
                  >
                    +
                  </button>
                </div>
              </div>
              {timed ? (
                <button
                  type="button"
                  className={
                    timer?.endsAt
                      ? `${styles.control} ${styles.timerOn}`
                      : styles.control
                  }
                  onClick={toggleTimer}
                  aria-label={
                    timer?.endsAt
                      ? "Pausar cronômetro do exercício"
                      : "Iniciar cronômetro do exercício"
                  }
                >
                  <span className={styles.label}>
                    {timer && timer.endsAt === null && timer.remaining === 0
                      ? "Tempo!"
                      : "Tempo"}
                  </span>
                  <span className={styles.value} role="timer">
                    {formatClock(timerLeft * 1000)}
                  </span>
                  <span className={styles.link}>
                    {timer?.endsAt
                      ? "Pausar"
                      : timer && timer.remaining === 0
                        ? "De novo"
                        : "Iniciar"}
                  </span>
                </button>
              ) : (
                <div className={styles.control}>
                  <span className={styles.label}>Repetições</span>
                  <span className={styles.value} aria-live="polite">
                    {draft.reps}
                  </span>
                  <div className={styles.pair}>
                    <button
                      type="button"
                      className={styles.step}
                      aria-label="Menos repetições"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          reps: Math.max(1, draft.reps - 1),
                        })
                      }
                    >
                      −
                    </button>
                    <button
                      type="button"
                      className={styles.step}
                      aria-label="Mais repetições"
                      onClick={() =>
                        setDraft({ ...draft, reps: draft.reps + 1 })
                      }
                    >
                      +
                    </button>
                  </div>
                </div>
              )}
            </div>
            <p className={styles.lastTime}>
              {item.last
                ? `Última vez: ${item.last.loadKg ? `${kg(item.last.loadKg)} kg × ` : ""}${item.last.reps ?? (item.last.durationSeconds ? `${item.last.durationSeconds} s` : "")}`
                : "Primeira vez neste exercício"}
            </p>
          </>
        )}
        {lastDone ? (
          <button
            type="button"
            className={styles.undo}
            onClick={() => void undoLastSet()}
          >
            Desfazer série {lastDone.setNumber}
          </button>
        ) : null}
      </div>

      <div className={styles.runBar}>
        <button
          type="button"
          className={styles.doneButton}
          disabled={busy || allDone}
          onClick={() => void completeSet()}
        >
          <span aria-hidden="true">✓</span>{" "}
          {cardio
            ? "Aeróbico feito"
            : `Fiz ${timed ? `${Math.max(1, timer ? (item.durationSeconds ?? 0) - (timer.endsAt ? timerLeft : timer.remaining) : (item.durationSeconds ?? 0))} s` : draft.reps}${draft.loadKg > 0 ? ` × ${kg(draft.loadKg)} kg` : ""}`}
          {!cardio && setNumber >= totalSets(item) && done < totalSets(item) ? (
            <small className={styles.doneHint}>última série</small>
          ) : null}
        </button>
        <button
          type="button"
          className={styles.music}
          onClick={() => setSheet("music")}
        >
          <span aria-hidden="true">♪</span> Música
        </button>
      </div>

      {rest ? (
        <div
          className={styles.rest}
          role="dialog"
          aria-modal="true"
          aria-label="Descanso"
        >
          <div className={styles.restTop}>
            <span className={styles.restEyebrow}>Descanso</span>
            <span className={styles.muted}>Treino {formatClock(activeMs)}</span>
          </div>
          <div className={styles.ring}>
            <svg
              width="260"
              height="260"
              viewBox="0 0 260 260"
              aria-hidden="true"
            >
              <circle
                cx="130"
                cy="130"
                r="112"
                fill="none"
                stroke="var(--fitos-color-surface-raised)"
                strokeWidth="14"
              />
              <circle
                cx="130"
                cy="130"
                r="112"
                fill="none"
                stroke={
                  restLeft <= 3
                    ? "var(--fitos-orange-500)"
                    : "var(--fitos-teal-300)"
                }
                strokeWidth="14"
                strokeLinecap="round"
                strokeDasharray={ring}
                strokeDashoffset={ring * (1 - restPercent)}
                transform="rotate(-90 130 130)"
              />
            </svg>
            <div className={styles.ringText}>
              <span role="timer" className={styles.restClock}>
                {formatClock(restLeft * 1000)}
              </span>
              <span className={styles.muted}>respire</span>
            </div>
          </div>
          <div className={styles.pair}>
            <button
              type="button"
              className={styles.restStep}
              onClick={() =>
                setRest({
                  ...rest,
                  endsAt: Math.max(Date.now(), rest.endsAt - 15_000),
                })
              }
            >
              −15 s
            </button>
            <button
              type="button"
              className={styles.restStep}
              onClick={() =>
                setRest({
                  endsAt: rest.endsAt + 15_000,
                  total: rest.total + 15,
                })
              }
            >
              +15 s
            </button>
          </div>
          <p className={styles.upNext}>
            <span className={styles.muted}>A seguir</span>
            <strong>{nextForRest}</strong>
          </p>
          <button
            type="button"
            className={styles.startButton}
            onClick={() => setRest(null)}
          >
            Pular descanso
          </button>
        </div>
      ) : null}

      <Sheet
        open={sheet === "how"}
        onClose={() => setSheet(null)}
        title={item.name}
      >
        <ExerciseThumbnail
          src={item.imageUrl}
          alt={item.imageAlt ?? item.name}
          width={480}
          height={220}
          className={styles.howImg}
        />
        {steps.length > 0 ? (
          <ol className={styles.steps}>
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        ) : (
          <p className={styles.muted}>
            Siga a orientação do seu personal. Movimento controlado, sem pressa.
          </p>
        )}
        <p className={styles.warn}>
          Sentiu dor na articulação? Pare e avise{" "}
          {props.coachName
            ? props.coachName.split(/\s+/)[0]
            : "um profissional"}
          .
        </p>
        <Button
          type="button"
          variant="secondary"
          block
          onClick={() => setSheet(null)}
        >
          Voltar ao treino
        </Button>
      </Sheet>

      <Sheet
        open={sheet === "list"}
        onClose={() => setSheet(null)}
        title="Treino completo"
        description="Aparelho ocupado? Toque em outro exercício para fazer ele agora."
      >
        <ul className={styles.list}>
          {order.map((index) => {
            const entry = items[index]!;
            const complete = entry.doneSets.length >= totalSets(entry);
            const tag = complete
              ? "Feito"
              : index === current
                ? "Agora"
                : skipped.has(entry.id)
                  ? "Pulado"
                  : `${entry.doneSets.length}/${totalSets(entry)}`;
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  className={
                    index === current
                      ? `${styles.listRow} ${styles.listNow}`
                      : styles.listRow
                  }
                  disabled={complete}
                  onClick={() => goTo(index)}
                >
                  <ExerciseThumbnail
                    src={entry.imageUrl}
                    alt=""
                    width={52}
                    height={52}
                    className={styles.listThumb}
                  />
                  <span className={styles.listText}>
                    <strong>{entry.name}</strong>
                    <span className={styles.muted}>
                      {prescriptionLine(entry)}
                    </span>
                  </span>
                  <span className={styles.listTag}>{tag}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {free ? (
          <Button type="button" variant="secondary" block onClick={openLibrary}>
            + Adicionar exercício
          </Button>
        ) : null}
        <Button type="button" variant="outlined" block onClick={skipCurrent}>
          Pular este exercício
        </Button>
      </Sheet>

      {endSheet}

      {musicSheet}
      {busySheet}
      {library}
    </div>
  );
}
