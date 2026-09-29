"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandLogo, FormAlert } from "@/shared/ui";
import styles from "./WorkoutRunner.module.css";

export interface RunnerItemResult {
  setsCompleted: number | null;
  repsCompleted: number | null;
  durationSecondsCompleted: number | null;
  loadUsed: string | null;
}

export interface RunnerItem {
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
  result: RunnerItemResult | null;
}

export interface WorkoutRunnerProps {
  sessionId: string;
  workoutName: string;
  /// Início real da sessão no servidor (ISO) — base do relógio quando este
  /// aparelho ainda não tem estado salvo do cronômetro.
  startedAt: string;
  items: RunnerItem[];
  /// "student": prescrição do Personal, somente leitura (registra o
  /// realizado sem alterar o modelo). "individual": FitOS Livre — ajuste
  /// rápido de carga e atalho para editar a própria sequência.
  mode: "student" | "individual";
  /// Base da API da sessão: `/api/workout-sessions` (Aluno) ou
  /// `/api/minhas-sessoes` (Livre). Mesmos contratos de sempre.
  apiBase: string;
  exitHref: string;
  /// Só no Livre: treino de origem, para "Editar sequência".
  workoutId?: string;
}

interface ClockState {
  accumulatedMs: number;
  runningSince: number | null;
}

interface PersistedState {
  clock: ClockState;
  index: number;
  restEndsAt: number | null;
}

const STORAGE_PREFIX = "fitos:sessao:";

function storageKey(sessionId: string) {
  return `${STORAGE_PREFIX}${sessionId}`;
}

function readPersisted(sessionId: string): PersistedState | null {
  try {
    const raw = window.localStorage.getItem(storageKey(sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    if (typeof parsed?.clock?.accumulatedMs !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writePersisted(sessionId: string, state: PersistedState) {
  try {
    window.localStorage.setItem(storageKey(sessionId), JSON.stringify(state));
  } catch {
    // Armazenamento indisponível (aba privada): o relógio segue em memória.
  }
}

function clearPersisted(sessionId: string) {
  try {
    window.localStorage.removeItem(storageKey(sessionId));
  } catch {
    // idem
  }
}

function elapsedMs(clock: ClockState, now: number): number {
  return clock.accumulatedMs + (clock.runningSince !== null ? Math.max(0, now - clock.runningSince) : 0);
}

export function formatClock(totalMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(totalMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

function totalSetsFor(item: RunnerItem): number {
  return item.sets && item.sets > 0 ? item.sets : 1;
}

function initialDone(item: RunnerItem): number {
  return Math.min(item.result?.setsCompleted ?? 0, totalSetsFor(item));
}

/// Ajuste rápido de carga do FitOS Livre: altera só o número inicial do
/// texto livre ("40 kg" → "42,5 kg"), preservando a unidade digitada.
/// Texto sem número não é alterado (o campo continua editável).
export function adjustLoad(load: string, delta: number): string {
  const match = load.match(/^(\s*)(\d+(?:[.,]\d+)?)(.*)$/);
  if (!match) {
    return load.trim() === "" && delta > 0 ? `${String(delta).replace(".", ",")} kg` : load;
  }
  const current = Number.parseFloat(match[2]!.replace(",", "."));
  const next = Math.max(0, Math.round((current + delta) * 10) / 10);
  const formatted = Number.isInteger(next) ? String(next) : String(next).replace(".", ",");
  return `${match[1]}${formatted}${match[3] || " kg"}`;
}

const LOAD_STEP = 2.5;

type AudioChoice = null | "spotify" | "apple";

/// Tela de treino durante a execução (AjustesTreinoAluno/AjustesTreinoLivre,
/// 29/09/2026) — Aluno (`/painel/treino/sessao`) e FitOS Livre
/// (`/painel/meus-treinos/sessao`) com o mesmo motor e os mesmos
/// contratos de API de antes (`resultados`/`concluir`/`abandonar`).
///
/// - Tempo total da sessão sempre visível, com iniciar/pausar, persistido
///   neste aparelho (`localStorage`, por sessão) ao sair e voltar; sem
///   estado local, parte do início real da sessão no servidor. Pausar
///   nunca conclui série.
/// - Descanso é uma contagem separada que começa ao concluir uma série e
///   pode ser pulada; vibração ao fim só quando o navegador oferece.
/// - Exercício atual, posição na sequência, prescrição, série atual,
///   progresso e próximo exercício. "Concluir série" grava de verdade o
///   realizado (séries, repetições/duração e carga) via upsert idempotente
///   por exercício — o contrato atual guarda o agregado por exercício,
///   não uma linha por série (lacuna documentada em EPIC-18).
/// - Áudio: sem player próprio licenciado, só oferece abrir o app
///   externo (Spotify/Apple Music). Nenhuma conta é conectada e nenhuma
///   reprodução externa é controlada.
export function WorkoutRunner({ sessionId, workoutName, startedAt, items, mode, apiBase, exitHref, workoutId }: WorkoutRunnerProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(0);
  const [clock, setClock] = useState<ClockState>({ accumulatedMs: 0, runningSince: null });
  const [index, setIndex] = useState(() => {
    const firstPending = items.findIndex((item) => initialDone(item) < totalSetsFor(item));
    return firstPending === -1 ? Math.max(0, items.length - 1) : firstPending;
  });
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [done, setDone] = useState<Record<string, number>>(() => Object.fromEntries(items.map((item) => [item.id, initialDone(item)])));
  const [reps, setReps] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      items.map((item) => {
        const value = item.durationSeconds && !item.reps ? item.result?.durationSecondsCompleted ?? item.durationSeconds : item.result?.repsCompleted ?? item.reps;
        return [item.id, value != null ? String(value) : ""];
      })
    )
  );
  const [loads, setLoads] = useState<Record<string, string>>(() => Object.fromEntries(items.map((item) => [item.id, item.result?.loadUsed ?? item.load ?? ""])));
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const [editingActual, setEditingActual] = useState(false);
  const [audioOpen, setAudioOpen] = useState(false);
  const [audioChoice, setAudioChoice] = useState<AudioChoice>(null);
  const vibratedFor = useRef<number | null>(null);

  // Restaura (ou inicia) o relógio só depois de montar — o HTML do servidor
  // nunca depende do relógio do navegador.
  useEffect(() => {
    const stored = readPersisted(sessionId);
    const current = Date.now();
    /* eslint-disable react-hooks/set-state-in-effect -- sincronização única com o armazenamento do navegador após a hidratação */
    if (stored) {
      setClock(stored.clock);
      if (stored.index >= 0 && stored.index < items.length) setIndex(stored.index);
      setRestEndsAt(stored.restEndsAt !== null && stored.restEndsAt > current ? stored.restEndsAt : null);
    } else {
      const serverStart = Date.parse(startedAt);
      setClock({ accumulatedMs: 0, runningSince: Number.isFinite(serverStart) ? Math.min(serverStart, current) : current });
    }
    setNow(current);
    setMounted(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [sessionId, startedAt, items.length]);

  useEffect(() => {
    if (!mounted) return;
    writePersisted(sessionId, { clock, index, restEndsAt });
  }, [mounted, sessionId, clock, index, restEndsAt]);

  const ticking = mounted && (clock.runningSince !== null || restEndsAt !== null);
  useEffect(() => {
    if (!ticking) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [ticking]);

  const restRemaining = restEndsAt !== null ? Math.max(0, Math.ceil((restEndsAt - now) / 1000)) : null;

  useEffect(() => {
    if (restEndsAt === null || restRemaining === null || restRemaining > 0) return;
    if (vibratedFor.current !== restEndsAt && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate([200, 100, 200]);
    }
    vibratedFor.current = restEndsAt;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- o descanso termina quando a contagem real chega a zero
    setRestEndsAt(null);
  }, [restEndsAt, restRemaining]);

  const hasUnsaved = Object.values(dirty).some(Boolean);

  useEffect(() => {
    if (!hasUnsaved) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsaved]);

  const totals = useMemo(() => {
    const total = items.reduce((sum, item) => sum + totalSetsFor(item), 0);
    const completed = items.reduce((sum, item) => sum + (done[item.id] ?? 0), 0);
    return { total, completed };
  }, [items, done]);

  const toggleClock = useCallback(() => {
    const current = Date.now();
    setNow(current);
    setClock((state) =>
      state.runningSince !== null
        ? { accumulatedMs: state.accumulatedMs + Math.max(0, current - state.runningSince), runningSince: null }
        : { accumulatedMs: state.accumulatedMs, runningSince: current }
    );
  }, []);

  if (items.length === 0) {
    return (
      <div className={styles.screen}>
        <RunnerHeader exitHref={exitHref} exitLabel="Sair" />
        <p className={styles.sessionLine}>{workoutName}</p>
        <p className={styles.empty}>Este treino ainda não tem exercícios.</p>
      </div>
    );
  }

  const item = items[index]!;
  const next = items[index + 1] ?? null;
  const setsTotal = totalSetsFor(item);
  const setsDone = done[item.id] ?? 0;
  const exerciseComplete = setsDone >= setsTotal;
  const usesDuration = Boolean(item.durationSeconds && !item.reps);
  const running = clock.runningSince !== null;
  const elapsed = mounted ? formatClock(elapsedMs(clock, now)) : "--:--";
  const progressPercent = totals.total > 0 ? Math.round((totals.completed / totals.total) * 100) : 0;

  function markDirty(itemId: string) {
    setDirty((current) => ({ ...current, [itemId]: true }));
  }

  async function concluirSerie() {
    if (saving || exerciseComplete) return;
    setError(null);
    setSaving(true);
    const nextDone = setsDone + 1;
    const value = reps[item.id]?.trim() ?? "";
    try {
      const response = await fetch(`${apiBase}/${sessionId}/resultados`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workoutExerciseId: item.id,
          setsCompleted: nextDone,
          repsCompleted: usesDuration || value === "" ? null : Number(value),
          durationSecondsCompleted: usesDuration && value !== "" ? Number(value) : null,
          loadUsed: loads[item.id]?.trim() ? loads[item.id]!.trim() : null,
        }),
      });
      setSaving(false);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.message ?? "Não foi possível registrar a série. Tente novamente.");
        return;
      }
      setDone((current) => ({ ...current, [item.id]: nextDone }));
      setDirty((current) => ({ ...current, [item.id]: false }));
      const isLastSetOfWorkout = nextDone >= setsTotal && !next;
      if (item.restSeconds && !isLastSetOfWorkout) {
        const current = Date.now();
        setNow(current);
        setRestEndsAt(current + item.restSeconds * 1000);
      }
      if (nextDone >= setsTotal && next) {
        setIndex(index + 1);
      }
    } catch {
      setSaving(false);
      setError("Falha de conexão. Verifique sua internet e tente novamente.");
    }
  }

  function goTo(target: number) {
    if (target < 0 || target >= items.length) return;
    setError(null);
    setIndex(target);
  }

  function confirmLeave(message: string): boolean {
    return !hasUnsaved || window.confirm(message);
  }

  async function finalizar(action: "concluir" | "abandonar", confirmMessage?: string) {
    if (isFinishing) return;
    const message = confirmMessage
      ? confirmMessage
      : action === "abandonar"
        ? "Abandonar este treino? As séries já registradas ficam no histórico; o que não foi salvo será perdido."
        : hasUnsaved
          ? "Você tem ajustes ainda não registrados. Concluir o treino mesmo assim?"
          : null;
    if (message && !window.confirm(message)) return;
    setError(null);
    setIsFinishing(true);
    try {
      const response = await fetch(`${apiBase}/${sessionId}/${action}`, { method: "POST" });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.message ?? "Não foi possível concluir a ação. Tente novamente.");
        setIsFinishing(false);
        return;
      }
      clearPersisted(sessionId);
      router.push("/painel");
    } catch {
      setError("Falha de conexão. Verifique sua internet e tente novamente.");
      setIsFinishing(false);
    }
  }

  const prescribedLoad = item.load?.trim() ? item.load.trim() : null;

  return (
    <div className={styles.screen}>
      <RunnerHeader
        exitHref={exitHref}
        exitLabel={mode === "individual" ? "Encerrar sessão" : "Sair"}
        onExit={(event) => {
          if (mode === "individual") {
            event.preventDefault();
            void finalizar(
              "concluir",
              hasUnsaved
                ? "Encerrar a sessão agora? Há ajustes ainda não registrados, que serão perdidos. As séries já registradas ficam no histórico."
                : "Encerrar a sessão agora? O treino será concluído com as séries já registradas."
            );
            return;
          }
          if (!confirmLeave("Você tem ajustes ainda não registrados nesta série. Sair mesmo assim? A sessão continua em andamento.")) {
            event.preventDefault();
          }
        }}
      />

      <div className={styles.sessionLine}>
        <span className={styles.sessionName}>{workoutName}</span>
        <span className={styles.sessionCount}>
          {index + 1} de {items.length}
        </span>
      </div>

      <section className={styles.clockBlock} aria-label="Tempo de treino">
        <div>
          <p className={styles.label}>Tempo de treino</p>
          <p className={styles.clock} role="timer" aria-live="off">
            {elapsed}
          </p>
          {!running && mounted ? <p className={styles.paused}>Relógio pausado</p> : null}
        </div>
        <button
          type="button"
          className={styles.clockToggle}
          onClick={toggleClock}
          aria-label={running ? "Pausar tempo de treino" : "Iniciar tempo de treino"}
          aria-pressed={!running}
        >
          <span aria-hidden="true">{running ? <PauseIcon /> : <PlayIcon />}</span>
        </button>
      </section>

      <div
        className={styles.progress}
        role="progressbar"
        aria-label="Progresso do treino"
        aria-valuemin={0}
        aria-valuemax={totals.total}
        aria-valuenow={totals.completed}
        aria-valuetext={`${totals.completed} de ${totals.total} séries concluídas`}
      >
        <span style={{ width: `${progressPercent}%` }} />
      </div>

      <section className={styles.exercise} aria-labelledby="exercicio-atual">
        <div className={styles.eyebrowRow}>
          <p className={styles.label}>Exercício atual</p>
          <p className={styles.label}>
            {String(index + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}
          </p>
        </div>
        <h1 id="exercicio-atual" className={styles.exerciseName}>
          {item.exerciseName}
        </h1>
        <p className={styles.exerciseHint}>
          {mode === "student" ? "Prescrito pelo seu Personal" : "Seu treino · ajuste a carga a cada série"}
          {item.exerciseMuscle ? ` · ${item.exerciseMuscle}` : ""}
        </p>

        <dl className={styles.prescription}>
          <div>
            <dt>{usesDuration ? "segundos" : "repetições"}</dt>
            <dd>{usesDuration ? item.durationSeconds : item.reps ?? "—"}</dd>
          </div>
          <div>
            <dt>{mode === "student" ? "carga prevista" : "carga atual"}</dt>
            <dd>{mode === "student" ? prescribedLoad ?? "—" : loads[item.id]?.trim() || "—"}</dd>
          </div>
          <div>
            <dt>descanso</dt>
            <dd>{item.restSeconds ? `${item.restSeconds} s` : "—"}</dd>
          </div>
        </dl>
        {item.notes ? <p className={styles.notes}>{item.notes}</p> : null}
        {item.instructions ? (
          <details className={styles.instructions}>
            <summary>Como executar</summary>
            <p>{item.instructions}</p>
          </details>
        ) : null}
      </section>

      <section className={styles.setBlock} aria-label="Série atual">
        <div className={styles.setHeader}>
          <span>{exerciseComplete ? "Exercício concluído" : "Série atual"}</span>
          <strong>
            {Math.min(setsDone + 1, setsTotal)} de {setsTotal}
          </strong>
        </div>
        <ol className={styles.setBars} aria-hidden="true">
          {Array.from({ length: setsTotal }, (_, setIndex) => (
            <li key={setIndex} className={setIndex < setsDone ? styles.setDone : setIndex === setsDone ? styles.setCurrent : undefined} />
          ))}
        </ol>

        {mode === "individual" ? (
          <div className={styles.loadAdjust}>
            <span>Ajustar carga</span>
            <button
              type="button"
              aria-label="Diminuir carga"
              onClick={() => {
                setLoads((current) => ({ ...current, [item.id]: adjustLoad(current[item.id] ?? "", -LOAD_STEP) }));
                markDirty(item.id);
              }}
            >
              −
            </button>
            <strong aria-live="polite">{loads[item.id]?.trim() || "—"}</strong>
            <button
              type="button"
              aria-label="Aumentar carga"
              onClick={() => {
                setLoads((current) => ({ ...current, [item.id]: adjustLoad(current[item.id] ?? "", LOAD_STEP) }));
                markDirty(item.id);
              }}
            >
              +
            </button>
          </div>
        ) : null}

        <div className={styles.actualSummary}>
          <span>
            Realizado:{" "}
            <strong>
              {reps[item.id]?.trim() ? `${reps[item.id]!.trim()} ${usesDuration ? "s" : "rep."}` : "—"}
              {loads[item.id]?.trim() ? ` · ${loads[item.id]!.trim()}` : ""}
            </strong>
          </span>
          <button type="button" aria-expanded={editingActual} aria-controls={`realizado-${item.id}`} onClick={() => setEditingActual((open) => !open)}>
            {editingActual ? "Fechar" : "Alterar"}
          </button>
        </div>
        {editingActual ? (
          <div id={`realizado-${item.id}`} className={styles.actualFields}>
            <label className={styles.actualField}>
              <span>{usesDuration ? "Segundos realizados" : "Repetições realizadas"}</span>
              <input
                name={`reps-${item.id}`}
                type="number"
                inputMode="numeric"
                min={1}
                value={reps[item.id] ?? ""}
                onChange={(event) => {
                  setReps((current) => ({ ...current, [item.id]: event.target.value }));
                  markDirty(item.id);
                }}
              />
            </label>
            <label className={styles.actualField}>
              <span>Carga realizada</span>
              <input
                name={`load-${item.id}`}
                type="text"
                value={loads[item.id] ?? ""}
                onChange={(event) => {
                  setLoads((current) => ({ ...current, [item.id]: event.target.value }));
                  markDirty(item.id);
                }}
              />
            </label>
          </div>
        ) : null}

        {error ? <FormAlert variant="error">{error}</FormAlert> : null}

        <button type="button" className={styles.primary} onClick={concluirSerie} disabled={saving || exerciseComplete}>
          {saving ? "Registrando…" : exerciseComplete ? "Séries registradas" : "Concluir série"}
        </button>

        {restRemaining !== null ? (
          <div className={styles.rest} role="status">
            <span className={styles.label}>Descanso</span>
            <strong aria-live="off">{formatClock(restRemaining * 1000)}</strong>
            <button type="button" onClick={() => setRestEndsAt(null)}>
              Pular descanso
            </button>
          </div>
        ) : null}
      </section>

      <section className={styles.audio}>
        <button type="button" className={styles.audioRow} aria-expanded={audioOpen} aria-controls="audio-options" onClick={() => setAudioOpen((open) => !open)}>
          <span className={styles.audioIcon} aria-hidden="true">
            <MusicIcon />
          </span>
          <span className={styles.audioText}>
            <strong>Áudio durante o treino</strong>
            <span>
              {audioChoice === "spotify"
                ? "Spotify aberto em outro app"
                : audioChoice === "apple"
                  ? "Apple Music aberto em outro app"
                  : "Conectar player ou abrir música"}
            </span>
          </span>
          <span className={styles.chevron} aria-hidden="true">
            ›
          </span>
        </button>
        {audioOpen ? (
          <div id="audio-options" className={styles.audioOptions}>
            <p>O FitOS ainda não tem um player próprio. Abra seu app de música — ele continua tocando enquanto você registra o treino aqui.</p>
            <a href="https://open.spotify.com" target="_blank" rel="noopener noreferrer" onClick={() => setAudioChoice("spotify")}>
              Abrir Spotify
            </a>
            <a href="https://music.apple.com" target="_blank" rel="noopener noreferrer" onClick={() => setAudioChoice("apple")}>
              Abrir Apple Music
            </a>
            <p className={styles.audioNote}>Nenhuma conta é conectada e o FitOS não controla a reprodução do app externo.</p>
          </div>
        ) : null}
      </section>

      <div className={styles.nextRow}>
        <span>{next ? `Próximo: ${next.exerciseName}` : "Último exercício do treino"}</span>
        {next ? (
          <button type="button" onClick={() => goTo(index + 1)}>
            Ver próximo <span aria-hidden="true">→</span>
          </button>
        ) : null}
      </div>
      {index > 0 ? (
        <button type="button" className={styles.prevLink} onClick={() => goTo(index - 1)}>
          <span aria-hidden="true">←</span> Exercício anterior
        </button>
      ) : null}

      <div className={styles.finish}>
        <button type="button" className={styles.finishPrimary} onClick={() => finalizar("concluir")} disabled={isFinishing}>
          {isFinishing ? "Enviando…" : "Concluir treino"}
        </button>
        <button type="button" className={styles.finishSecondary} onClick={() => finalizar("abandonar")} disabled={isFinishing}>
          Abandonar treino
        </button>
        {mode === "individual" && workoutId ? (
          <Link href={`/painel/meus-treinos/${workoutId}`} className={styles.editLink}>
            Editar sequência do treino
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function RunnerHeader({
  exitHref,
  exitLabel,
  onExit,
}: {
  exitHref: string;
  exitLabel: string;
  onExit?: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <header className={styles.header}>
      <BrandLogo background="photo" size={44} className={styles.logo} />
      <Link href={exitHref} className={styles.exit} onClick={onExit}>
        {exitLabel}
      </Link>
    </header>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
      <rect x="6" y="5" width="4" height="14" rx="1.5" />
      <rect x="14" y="5" width="4" height="14" rx="1.5" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
      <path d="M8 5.5v13a1 1 0 0 0 1.5.9l10.2-6.5a1 1 0 0 0 0-1.7L9.5 4.6A1 1 0 0 0 8 5.5Z" />
    </svg>
  );
}

function MusicIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V6l10-2v12" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="16.5" cy="16" r="2.5" />
    </svg>
  );
}
