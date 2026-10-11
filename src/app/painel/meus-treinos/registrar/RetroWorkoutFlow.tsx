"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, ChipGroup, FormAlert, Sheet, WizardProgress } from "@/shared/ui";
import { isCardioType } from "@/shared/lib/cardio";
import { resizeImage } from "@/shared/lib/resizeImage";
import { RETRO_MAX_DAYS, durationLabel, durationSeconds, validatePerformedAt } from "@/shared/lib/retroactive";
import { ExerciseLibrary } from "../../_workout-builder/ExerciseLibrary";
import type { LibraryExercise } from "../../_workout-builder/types";
import { formatPoints } from "@/shared/lib/scoring";
import { SessionPointsCard } from "../../_live/SessionPointsCard";
import { blockResultSummary, blockSummary, type WorkoutBlock } from "@/shared/lib/workoutBlocks";
import { BlockSheet } from "../../_workout-builder/BlockSheet";
import { BlockResultForm, emptyResultDraft, resultPayload, type BlockResultDraft } from "../../_live/BlockResultForm";
import { draftFrom, type BlockResultView } from "../../_live/BlockPanel";
import styles from "./RetroWorkoutFlow.module.css";

interface SetRow {
  reps: string;
  load: string;
  minutes: string;
}

interface Item {
  exercise: LibraryExercise;
  cardio: boolean;
  sets: SetRow[];
  /// Funcional e CrossFit: dentro de um bloco, conta pelo resultado dele.
  blockKey: string | null;
}

/// Bloco feito e o resultado declarado (`draft` nulo: ainda não informado).
interface RetroBlock {
  block: WorkoutBlock;
  draft: BlockResultDraft | null;
}

/// O rascunho no formato do resumo ("5 voltas + 8 reps").
function draftSummary(block: WorkoutBlock, draft: BlockResultDraft): string {
  const payload = resultPayload(block, draft, true);
  return blockResultSummary(block, { outcome: payload.outcome, roundsCompleted: payload.roundsCompleted, partialReps: payload.partialReps, intervalsCompleted: payload.intervalsCompleted, elapsedSeconds: payload.elapsedSeconds ?? null });
}

interface Photo {
  blob: Blob;
  width: number;
  height: number;
  url: string;
}

const STEPS = ["Execução", "Duração", "Comprovação", "Revisão"] as const;
const DAY_MS = 86_400_000;
const SAO_PAULO_OFFSET_MS = -3 * 3_600_000;

/// "AAAA-MM-DD" e "HH:MM" no horário de Brasília.
function localParts(instant: Date) {
  const iso = new Date(instant.getTime() + SAO_PAULO_OFFSET_MS).toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" });
const timeFmt = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

function number(value: string): number | null {
  const parsed = Number(value.replace(",", "."));
  return value.trim() === "" || !Number.isFinite(parsed) ? null : parsed;
}

function newItem(exercise: LibraryExercise): Item {
  const cardio = isCardioType(exercise.type);
  return { exercise, cardio, blockKey: null, sets: cardio ? [{ reps: "", load: "", minutes: "20" }] : [1, 2, 3].map(() => ({ reps: "10", load: "", minutes: "" })) };
}

function volumeKg(item: Item): number {
  return item.sets.reduce((sum, set) => sum + (number(set.reps) ?? 0) * (number(set.load) ?? 0), 0);
}

/// "3 × 10 × 30 kg" quando todas as séries são iguais; senão, a lista.
function setsSummary(item: Item): string {
  if (item.cardio) return `${item.sets.reduce((sum, set) => sum + (number(set.minutes) ?? 0), 0)} min`;
  const labels = item.sets.map((set) => `${set.reps}${number(set.load) ? ` × ${number(set.load)} kg` : ""}`);
  return labels.every((label) => label === labels[0]) ? `${item.sets.length} × ${labels[0]}` : labels.join(" · ");
}

/// Registro existente para editar (feature 2, parte 2).
export interface RetroEdit {
  sessionId: string;
  performedAtIso: string;
  durationSeconds: number;
  items: { exercise: LibraryExercise; blockKey?: string | null; sets: { reps: number | null; loadKg: number | null; durationSeconds: number | null }[] }[];
  blocks?: { block: WorkoutBlock; result: BlockResultView }[];
}

function editItem(item: RetroEdit["items"][number]): Item {
  const cardio = isCardioType(item.exercise.type);
  return {
    exercise: item.exercise,
    cardio,
    blockKey: item.blockKey ?? null,
    sets: item.blockKey && item.sets.length === 0 ? newItem(item.exercise).sets : item.sets.map((set) => ({ reps: set.reps === null ? "" : String(set.reps), load: set.loadKg === null ? "" : String(set.loadKg).replace(".", ","), minutes: set.durationSeconds === null ? "" : String(Math.round(set.durationSeconds / 60)) })),
  };
}

/// Registrar treino realizado (feature 2): mesma escolha de exercícios do
/// treino avulso, sem cronômetro. Data e execução, duração total única,
/// foto (opcional, sem ela não há pontos) e revisão. Cada etapa guarda os
/// dados ao voltar; o envio final tem chave única (retry não duplica).
/// Com `edit`, edita o registro (sem a etapa da foto: as fotos ficam no
/// detalhe do treino) e volta para ele.
/// Com `blocksEnabled` (FEATURE_FUNCIONAL), blocos com o resultado
/// quantitativo (voltas, round parcial, intervalos, tempo do For Time).
export function RetroWorkoutFlow({ library, nowIso, pointsEnabled, edit, blocksEnabled = false }: { library: LibraryExercise[]; nowIso: string; pointsEnabled: boolean; edit?: RetroEdit; blocksEnabled?: boolean }) {
  const router = useRouter();
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const initial = localParts(edit ? new Date(edit.performedAtIso) : now);
  const today = localParts(now);
  const [step, setStep] = useState(0);
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [items, setItems] = useState<Item[]>(() => (edit ? edit.items.map(editItem) : []));
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [blocks, setBlocks] = useState<RetroBlock[]>(() => (edit?.blocks ?? []).map(({ block, result }) => ({ block, draft: draftFrom(block, result) })));
  /// Bloco aberto: formato (`config`, `null` = novo) ou resultado.
  const [blockSheet, setBlockSheet] = useState<{ kind: "config"; block: WorkoutBlock | null } | { kind: "result"; key: string; draft: BlockResultDraft } | null>(null);
  const [hours, setHours] = useState(edit ? String(Math.floor(edit.durationSeconds / 3600)) : "0");
  const [minutes, setMinutes] = useState(edit ? String(Math.floor((edit.durationSeconds % 3600) / 60)) : "45");
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [previewTenths, setPreviewTenths] = useState<number | null>(null);
  const [done, setDone] = useState<{ sessionId: string; photoSaved: boolean; possibleDuplicate: boolean } | null>(null);
  const operationKey = useRef<string>(crypto.randomUUID());
  const fileInput = useRef<HTMLInputElement>(null);

  const resultBlock = blockSheet?.kind === "result" ? (blocks.find((entry) => entry.block.key === blockSheet.key)?.block ?? null) : null;
  const performedAt = new Date(`${date}T${time || "00:00"}:00-03:00`);
  const minDate = localParts(new Date(now.getTime() - RETRO_MAX_DAYS * DAY_MS)).date;
  const duration = durationSeconds(Number(hours || 0), Number(minutes || 0));

  function updateSet(itemIndex: number, setIndex: number, patch: Partial<SetRow>) {
    setItems((current) => current.map((item, i) => (i === itemIndex ? { ...item, sets: item.sets.map((set, j) => (j === setIndex ? { ...set, ...patch } : set)) } : item)));
  }

  function addSet(itemIndex: number) {
    setItems((current) => current.map((item, i) => (i === itemIndex ? { ...item, sets: [...item.sets, { ...(item.sets.at(-1) ?? { reps: "10", load: "", minutes: "10" }) }] } : item)));
  }

  function removeSet(itemIndex: number, setIndex: number) {
    setItems((current) => current.map((item, i) => (i === itemIndex ? { ...item, sets: item.sets.filter((_, j) => j !== setIndex) } : item)).filter((item) => item.sets.length > 0));
  }

  function setItemBlock(itemIndex: number, blockKey: string | null) {
    setItems((current) => current.map((item, i) => (i === itemIndex ? { ...item, blockKey } : item)));
  }

  function saveBlockConfig(block: WorkoutBlock) {
    setBlocks((current) => (current.some((entry) => entry.block.key === block.key) ? current.map((entry) => (entry.block.key === block.key ? { block, draft: entry.block.kind === block.kind ? entry.draft : null } : entry)) : [...current, { block, draft: null }]));
    setBlockSheet(null);
  }

  function saveBlockResult(key: string, draft: BlockResultDraft) {
    setBlocks((current) => current.map((entry) => (entry.block.key === key ? { ...entry, draft } : entry)));
    setBlockSheet(null);
  }

  function removeBlock(key: string) {
    setBlocks((current) => current.filter((entry) => entry.block.key !== key));
    setItems((current) => current.map((item) => (item.blockKey === key ? { ...item, blockKey: null } : item)));
    setBlockSheet(null);
  }

  function validateExecution(): string | null {
    const dateError = validatePerformedAt(performedAt, new Date());
    if (dateError) return dateError;
    if (items.length === 0) return "Adicione pelo menos um exercício.";
    for (const { block, draft } of blocks) {
      if (!items.some((item) => item.blockKey === block.key)) return `Inclua pelo menos um exercício no bloco ${blockSummary(block)}.`;
      if (!draft) return `Informe o resultado do bloco ${blockSummary(block)}.`;
      if (block.kind === "FOR_TIME" && draft.outcome === "CONCLUIDO" && draft.minutes * 60 + draft.seconds <= 0) return `Informe em quanto tempo você concluiu o ${blockSummary(block)}.`;
    }
    for (const item of items) {
      if (item.blockKey) continue;
      for (const set of item.sets) {
        if (item.cardio ? !((number(set.minutes) ?? 0) >= 1) : !((number(set.reps) ?? 0) >= 1)) {
          return item.cardio ? `Informe os minutos de ${item.exercise.name}.` : `Informe as repetições de ${item.exercise.name}.`;
        }
        if ((number(set.load) ?? 0) < 0) return `Carga inválida em ${item.exercise.name}.`;
      }
    }
    return null;
  }

  function next() {
    const problem = step === 0 ? validateExecution() : step === 1 && typeof duration === "string" ? duration : null;
    setError(problem);
    if (problem) return;
    // Edição: da duração direto para a revisão (sem a etapa da foto).
    if (edit && step === 1) void review();
    else setStep((current) => current + 1);
  }

  async function choosePhoto(file: File | undefined) {
    if (!file) return;
    setPhotoBusy(true);
    setError(null);
    try {
      const resized = await resizeImage(file, { max: 1600 });
      if (photo) URL.revokeObjectURL(photo.url);
      setPhoto({ ...resized, url: URL.createObjectURL(resized.blob) });
    } catch {
      setError("Não foi possível ler a foto. Tente outra.");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function uploadPhoto(sessionId: string): Promise<boolean> {
    if (!photo) return false;
    const form = new FormData();
    form.set("foto", photo.blob, "treino.jpg");
    form.set("largura", String(photo.width));
    form.set("altura", String(photo.height));
    const response = await fetch(`/api/minhas-sessoes/${sessionId}/evidencias`, { method: "POST", body: form }).catch(() => null);
    return Boolean(response?.ok);
  }

  function payloadExercises() {
    return items.map((item) => ({
      exerciseId: item.exercise.id,
      ...(item.blockKey ? { blockKey: item.blockKey } : {}),
      sets: item.blockKey ? [] : item.sets.map((set) =>
        item.cardio ? { durationSeconds: Math.round((number(set.minutes) ?? 0) * 60) } : { reps: Math.round(number(set.reps) ?? 0), loadKg: number(set.load) }
      ),
    }));
  }

  function payloadBlocks() {
    return blocks.map(({ block, draft }) => ({ block, result: resultPayload(block, draft ?? emptyResultDraft(block), true) }));
  }

  /// Revisão: com os Desafios ligados, a prévia dos pontos (só calcula).
  async function review() {
    setStep(3);
    setPreviewTenths(null);
    if (!pointsEnabled) return;
    const response = await fetch("/api/minhas-sessoes/retroativo/previa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ exercises: payloadExercises() }) }).catch(() => null);
    const body = response?.ok ? ((await response.json().catch(() => null)) as { totalTenths?: number } | null) : null;
    if (typeof body?.totalTenths === "number") setPreviewTenths(body.totalTenths);
  }

  async function saveEdit() {
    if (!edit || busy || typeof duration === "string") return;
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/minhas-sessoes/${edit.sessionId}/registro`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ performedAt: performedAt.toISOString(), durationSeconds: duration, exercises: payloadExercises(), ...(blocksEnabled ? { blocks: payloadBlocks() } : {}) }),
    }).catch(() => null);
    if (!response?.ok) {
      const body = await response?.json().catch(() => null);
      setError(body?.message ?? "Não foi possível salvar. Verifique a conexão e tente de novo.");
      setBusy(false);
      return;
    }
    router.push(`/painel/treinos-realizados/${edit.sessionId}`);
    router.refresh();
  }

  async function submit() {
    if (edit) return saveEdit();
    if (busy || typeof duration === "string") return;
    setBusy(true);
    setError(null);
    const response = await fetch("/api/minhas-sessoes/retroativo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operationKey: operationKey.current,
        performedAt: performedAt.toISOString(),
        durationSeconds: duration,
        exercises: payloadExercises(),
        ...(blocksEnabled ? { blocks: payloadBlocks() } : {}),
      }),
    }).catch(() => null);
    if (!response?.ok) {
      const body = await response?.json().catch(() => null);
      setError(body?.message ?? "Não foi possível registrar. Verifique a conexão e tente de novo.");
      setBusy(false);
      return;
    }
    const result = (await response.json()) as { sessionId: string; possibleDuplicate: boolean };
    const photoSaved = await uploadPhoto(result.sessionId);
    setDone({ sessionId: result.sessionId, photoSaved, possibleDuplicate: result.possibleDuplicate });
    setBusy(false);
  }

  async function retryPhoto() {
    if (!done) return;
    setBusy(true);
    const photoSaved = await uploadPhoto(done.sessionId);
    setDone({ ...done, photoSaved });
    setBusy(false);
  }

  if (done) {
    return (
      <section className={styles.flow} aria-labelledby="registrado">
        <h2 id="registrado" className={styles.title}>
          Treino registrado
        </h2>
        <p className={styles.muted}>
          {dateFmt.format(performedAt)} · {timeFmt.format(performedAt)} · {typeof duration === "number" ? durationLabel(duration) : ""}
        </p>
        {done.possibleDuplicate ? <FormAlert variant="info">Já existe um treino perto desse horário. Confira no histórico se não ficou repetido.</FormAlert> : null}
        {photo && !done.photoSaved ? (
          <>
            <FormAlert variant="error">Treino salvo, mas a foto não foi enviada.{pointsEnabled ? " Sem foto, este treino não rende pontos." : ""}</FormAlert>
            <Button type="button" size="lg" block onClick={() => void retryPhoto()} disabled={busy}>
              {busy ? "Enviando…" : "Tentar enviar a foto de novo"}
            </Button>
          </>
        ) : (
          <p className={styles.ok}>{done.photoSaved ? "✓ Foto anexada" : pointsEnabled ? "Salvo sem pontuação." : "Salvo sem foto."}</p>
        )}
        {pointsEnabled ? <SessionPointsCard sessionId={done.sessionId} /> : null}
        <Link href={`/painel/treinos-realizados/${done.sessionId}`} className={styles.primaryLink}>
          Ver o treino
        </Link>
        <Link href="/painel/treinos-realizados" className={styles.secondaryLink}>
          Treinos realizados
        </Link>
      </section>
    );
  }

  return (
    <section className={styles.flow} aria-label="Registrar treino realizado">
      <WizardProgress step={edit && step === 3 ? 3 : step + 1} totalSteps={edit ? 3 : STEPS.length} />
      <p className={styles.eyebrow}>
        {String(edit && step === 3 ? 3 : step + 1).padStart(2, "0")} / {STEPS[step]}
        {edit ? " · Editando o registro" : ""}
      </p>

      {step === 0 ? (
        <>
          <h2 className={styles.title}>Quando você treinou?</h2>
          <p className={styles.muted}>Registro retroativo · até {RETRO_MAX_DAYS} dias</p>
          <div className={styles.when}>
            <label className={styles.field}>
              <span>Data</span>
              <input type="date" value={date} min={minDate} max={today.date} onChange={(event) => setDate(event.target.value)} />
            </label>
            <label className={styles.field}>
              <span>Horário</span>
              <input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
            </label>
          </div>

          <h2 className={styles.title}>O que você realizou?</h2>
          {items.map((item, itemIndex) => (
            <div key={item.exercise.id} className={styles.item}>
              <h3>{item.exercise.name}</h3>
              {blocks.length ? (
                <ChipGroup
                  label={`Bloco de ${item.exercise.name}`}
                  value={item.blockKey ?? ""}
                  onChange={(value) => setItemBlock(itemIndex, value || null)}
                  options={[{ value: "", label: "Séries" }, ...blocks.map(({ block }) => ({ value: block.key, label: blockSummary(block) }))]}
                />
              ) : null}
              {item.blockKey ? <p className={styles.muted}>Conta pelo resultado do bloco.</p> : null}
              {item.blockKey ? null : (
                <>
                  <table className={styles.sets}>
                    <thead>
                      <tr>
                        <th scope="col">Série</th>
                        {item.cardio ? <th scope="col">Minutos</th> : (
                          <>
                            <th scope="col">Repetições</th>
                            <th scope="col">Carga (kg)</th>
                          </>
                        )}
                        <th scope="col">
                          <span className={styles.hidden}>Remover</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {item.sets.map((set, setIndex) => (
                        <tr key={setIndex}>
                          <td>{setIndex + 1}</td>
                          {item.cardio ? (
                            <td>
                              <input aria-label={`Minutos da série ${setIndex + 1} de ${item.exercise.name}`} inputMode="numeric" value={set.minutes} onChange={(event) => updateSet(itemIndex, setIndex, { minutes: event.target.value })} />
                            </td>
                          ) : (
                            <>
                              <td>
                                <input aria-label={`Repetições da série ${setIndex + 1} de ${item.exercise.name}`} inputMode="numeric" value={set.reps} onChange={(event) => updateSet(itemIndex, setIndex, { reps: event.target.value })} />
                              </td>
                              <td>
                                <input aria-label={`Carga da série ${setIndex + 1} de ${item.exercise.name}`} inputMode="decimal" placeholder="—" value={set.load} onChange={(event) => updateSet(itemIndex, setIndex, { load: event.target.value })} />
                              </td>
                            </>
                          )}
                          <td>
                            <button type="button" className={styles.remove} aria-label={`Remover série ${setIndex + 1} de ${item.exercise.name}`} onClick={() => removeSet(itemIndex, setIndex)}>
                              ×
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button type="button" className={styles.link} onClick={() => addSet(itemIndex)}>
                    + Série
                  </button>
                </>
              )}
            </div>
          ))}
          <button type="button" className={styles.link} onClick={() => setLibraryOpen(true)}>
            + Adicionar exercício
          </button>
          {blocksEnabled ? (
            <>
              <h2 className={styles.title}>Blocos</h2>
              <p className={styles.muted}>Circuito, AMRAP, EMOM ou For Time: informe o formato e o resultado. Os exercícios do bloco não precisam de séries.</p>
              {blocks.map(({ block, draft }) => (
                <div key={block.key} className={styles.item}>
                  <h3>{blockSummary(block)}</h3>
                  <p className={draft ? styles.ok : styles.muted}>{draft ? draftSummary(block, draft) : "Resultado ainda não informado."}</p>
                  <div className={styles.blockActions}>
                    <button type="button" className={styles.link} onClick={() => setBlockSheet({ kind: "result", key: block.key, draft: draft ?? emptyResultDraft(block) })}>
                      {draft ? "Corrigir resultado" : "Informar resultado"}
                    </button>
                    <button type="button" className={styles.link} onClick={() => setBlockSheet({ kind: "config", block })}>
                      Editar bloco
                    </button>
                  </div>
                </div>
              ))}
              <button type="button" className={styles.link} onClick={() => setBlockSheet({ kind: "config", block: null })}>
                + Adicionar bloco
              </button>
            </>
          ) : null}
        </>
      ) : null}

      {step === 1 ? (
        <>
          <h2 className={styles.title}>Quanto tempo durou o treino inteiro?</h2>
          <p className={styles.muted}>Informe o total, incluindo os intervalos. Não há cronômetro neste registro.</p>
          <div className={styles.duration}>
            <label>
              <input aria-label="Horas" inputMode="numeric" value={hours} onChange={(event) => setHours(event.target.value.replace(/\D/g, "").slice(0, 2))} />
              <span>horas</span>
            </label>
            <span className={styles.colon} aria-hidden="true">
              :
            </span>
            <label>
              <input aria-label="Minutos" inputMode="numeric" value={minutes} onChange={(event) => setMinutes(event.target.value.replace(/\D/g, "").slice(0, 2))} />
              <span>minutos</span>
            </label>
          </div>
          <p className={styles.muted}>Um único tempo para o treino. Séries e cargas ficam por exercício.</p>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <h2 className={styles.title}>Comprove seu treino</h2>
          <p className={styles.muted}>
            {pointsEnabled ? "A foto é obrigatória para receber pontos. Você pode salvar o treino sem pontuar." : "Uma foto do treino fica guardada com o registro. É opcional."}
          </p>
          <input ref={fileInput} type="file" accept="image/*" className={styles.hidden} aria-label="Foto do treino" onChange={(event) => void choosePhoto(event.target.files?.[0])} />
          <button type="button" className={styles.photo} onClick={() => fileInput.current?.click()} disabled={photoBusy}>
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element -- prévia local (blob:) antes do envio
              <img src={photo.url} alt="Foto escolhida para o treino" />
            ) : (
              <>
                <strong>{photoBusy ? "Preparando…" : "Adicione uma foto"}</strong>
                <span>Vinculada a este treino</span>
              </>
            )}
          </button>
          {photo ? (
            <button type="button" className={styles.link} onClick={() => setPhoto(null)}>
              Remover foto
            </button>
          ) : null}
        </>
      ) : null}

      {step === 3 ? (
        <>
          <h2 className={styles.title}>Tudo certo para concluir?</h2>
          <p className={styles.muted}>
            {dateFmt.format(performedAt)} · {timeFmt.format(performedAt)}
          </p>
          <div className={styles.card}>
            <span>Tempo total</span>
            <strong>{typeof duration === "number" ? durationLabel(duration) : "—"}</strong>
          </div>
          {blocks.map(({ block, draft }) => (
            <div key={block.key} className={styles.summary}>
              <strong>{blockSummary(block)}</strong>
              <span>
                {draft ? draftSummary(block, draft) : "—"} · {items.filter((item) => item.blockKey === block.key).map((item) => item.exercise.name).join(", ")}
              </span>
            </div>
          ))}
          {items.filter((item) => !item.blockKey).map((item) => (
            <div key={item.exercise.id} className={styles.summary}>
              <strong>{item.exercise.name}</strong>
              <span>
                {setsSummary(item)}
                {!item.cardio && volumeKg(item) > 0 ? ` · Volume: ${volumeKg(item).toLocaleString("pt-BR")} kg` : ""}
              </span>
            </div>
          ))}
          {edit ? null : <p className={photo ? styles.ok : styles.muted}>{photo ? "✓ Foto anexada" : pointsEnabled ? "Adicione uma foto para receber os pontos." : "Sem foto."}</p>}
          {pointsEnabled && previewTenths !== null ? (
            <div className={styles.points}>
              <span>{edit ? "Com a edição, este treino renderá" : photo ? "Este treino renderá" : "Com foto, este treino renderia"}</span>
              <strong>{formatPoints(previewTenths)} pontos</strong>
              <span className={styles.muted}>Liberação automática, sujeita a contestação.</span>
            </div>
          ) : null}
        </>
      ) : null}

      {error ? <FormAlert variant="error">{error}</FormAlert> : null}

      <div className={styles.actions}>
        {step < 2 ? (
          <Button type="button" size="lg" block onClick={next}>
            {step === 0 ? "Continuar" : edit ? "Revisar alterações" : "Continuar para foto"}
          </Button>
        ) : null}
        {step === 2 ? (
          <>
            <Button type="button" size="lg" block onClick={() => void review()} disabled={photoBusy || !photo}>
              Continuar
            </Button>
            {photo ? null : (
              <Button type="button" variant="quiet" block onClick={() => void review()}>
                {pointsEnabled ? "Salvar sem pontuação" : "Continuar sem foto"}
              </Button>
            )}
          </>
        ) : null}
        {step === 3 ? (
          <Button type="button" size="lg" block onClick={() => void submit()} disabled={busy}>
            {busy ? (edit ? "Salvando…" : "Registrando…") : edit ? "Salvar alterações" : pointsEnabled && photo ? "Concluir e receber pontos" : "Concluir registro"}
          </Button>
        ) : null}
        {step > 0 ? (
          <Button type="button" variant="quiet" block onClick={() => setStep((current) => (edit && current === 3 ? 1 : current - 1))} disabled={busy}>
            Voltar
          </Button>
        ) : null}
      </div>

      {blockSheet?.kind === "config" ? (
        <BlockSheet initial={blockSheet.block} onClose={() => setBlockSheet(null)} onSave={saveBlockConfig} onRemove={blockSheet.block ? () => removeBlock(blockSheet.block!.key) : undefined} />
      ) : null}
      {blockSheet?.kind === "result" ? (
        <Sheet
          open
          onClose={() => setBlockSheet(null)}
          title="Resultado do bloco"
          description="Informe o que você realmente fez. A meta não conta como feito."
          footer={
            <Button type="button" block onClick={() => saveBlockResult(blockSheet.key, blockSheet.draft)}>
              Salvar resultado
            </Button>
          }
        >
          {resultBlock ? <BlockResultForm block={resultBlock} value={blockSheet.draft} onChange={(draft) => setBlockSheet({ kind: "result", key: blockSheet.key, draft })} declareTime /> : null}
        </Sheet>
      ) : null}
      {libraryOpen ? (
        <ExerciseLibrary
          exercises={library}
          alreadyInWorkout={items.map((item) => item.exercise.id)}
          onClose={() => setLibraryOpen(false)}
          onAdd={(ids) => {
            const chosen = ids.map((id) => library.find((exercise) => exercise.id === id)).filter((exercise): exercise is LibraryExercise => Boolean(exercise));
            setItems((current) => [...current, ...chosen.filter((exercise) => !current.some((item) => item.exercise.id === exercise.id)).map(newItem)]);
            setLibraryOpen(false);
          }}
          createExerciseHref={null}
        />
      ) : null}
    </section>
  );
}
