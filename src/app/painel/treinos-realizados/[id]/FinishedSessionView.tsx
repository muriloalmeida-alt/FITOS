"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, FormAlert, Sheet, Tag } from "@/shared/ui";
import { resizeImage } from "@/shared/lib/resizeImage";
import { durationLabel } from "@/shared/lib/retroactive";
import { SessionPointsCard } from "../../_live/SessionPointsCard";
import styles from "./FinishedSessionView.module.css";

interface Props {
  session: {
    id: string;
    mode: "LIVE" | "RETROATIVO";
    performedAtIso: string;
    recordedAtIso: string;
    durationSeconds: number | null;
    exercises: { exerciseId: string; name: string; cardio: boolean; sets: { reps: number | null; loadKg: number | null; durationSeconds: number | null }[] }[];
    evidenceIds: string[];
  };
  canEdit: boolean;
  canDelete: boolean;
  pointsEnabled: boolean;
}

const dateFmt = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const shortFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
/// Mesmo limite do servidor (`EVIDENCE_MAX_PER_SESSION`).
const MAX_PHOTOS = 3;

function setLabel(set: Props["session"]["exercises"][number]["sets"][number], cardio: boolean): string {
  if (cardio) return set.durationSeconds ? durationLabel(set.durationSeconds) : "—";
  return `${set.reps ?? "—"}${set.loadKg ? ` × ${set.loadKg.toLocaleString("pt-BR")} kg` : ""}`;
}

/// Treino realizado: resumo e séries, fotos (anexar depois, remover),
/// pontos dos Desafios e as ações do registro (editar no prazo, excluir).
export function FinishedSessionView({ session, canEdit, canDelete, pointsEnabled }: Props) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const photos = session.evidenceIds;

  async function addPhoto(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const resized = await resizeImage(file, { max: 1600 });
      const form = new FormData();
      form.set("foto", resized.blob, "treino.jpg");
      form.set("largura", String(resized.width));
      form.set("altura", String(resized.height));
      const response = await fetch(`/api/minhas-sessoes/${session.id}/evidencias`, { method: "POST", body: form });
      if (!response.ok) setError((await response.json().catch(() => null))?.message ?? "Não foi possível enviar a foto. Tente de novo.");
      router.refresh();
    } catch {
      setError("Não foi possível enviar a foto. Tente de novo.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function removePhoto(id: string) {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/evidencias-treino/${id}`, { method: "DELETE" }).catch(() => null);
    if (!response?.ok) setError("Não foi possível remover a foto. Tente de novo.");
    setBusy(false);
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/minhas-sessoes/${session.id}`, { method: "DELETE" }).catch(() => null);
    if (!response?.ok) {
      setError((await response?.json().catch(() => null))?.message ?? "Não foi possível excluir. Tente de novo.");
      setBusy(false);
      setConfirm(false);
      return;
    }
    router.push("/painel/treinos-realizados");
    router.refresh();
  }

  return (
    <div className={styles.view}>
      {session.mode === "RETROATIVO" ? (
        <span>
          <Tag>Registrado</Tag>
        </span>
      ) : null}
      <p className={styles.when}>{dateFmt.format(new Date(session.performedAtIso))}</p>
      <p className={styles.muted}>
        {[session.durationSeconds ? `Tempo total: ${durationLabel(session.durationSeconds)}` : null, session.mode === "RETROATIVO" ? `registrado em ${shortFmt.format(new Date(session.recordedAtIso))}` : null].filter(Boolean).join(" · ")}
      </p>

      <ul className={styles.exercises} aria-label="Exercícios">
        {session.exercises.map((exercise) => (
          <li key={exercise.exerciseId}>
            <strong>{exercise.name}</strong>
            <span>{exercise.sets.map((set) => setLabel(set, exercise.cardio)).join(" · ")}</span>
          </li>
        ))}
      </ul>

      <h2 className={styles.cap}>Fotos do treino</h2>
      {photos.length === 0 ? <p className={styles.muted}>{pointsEnabled ? "Sem foto, o treino fica salvo sem pontuação. Adicione uma foto para receber os pontos." : "Nenhuma foto."}</p> : null}
      {photos.length > 0 ? (
        <ul className={styles.photos}>
          {photos.map((id, index) => (
            <li key={id}>
              {/* eslint-disable-next-line @next/next/no-img-element -- foto privada servida pela rota autenticada */}
              <img src={`/api/evidencias-treino/${id}`} alt={`Foto ${index + 1} do treino`} />
              <button type="button" className={styles.removePhoto} onClick={() => void removePhoto(id)} disabled={busy} aria-label={`Remover foto ${index + 1}`}>
                Remover
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {photos.length < MAX_PHOTOS ? (
        <>
          <input ref={input} type="file" accept="image/*" className={styles.hidden} aria-label="Foto do treino" onChange={(event) => void addPhoto(event.target.files?.[0])} />
          <Button type="button" variant="secondary" block onClick={() => input.current?.click()} disabled={busy}>
            {busy ? "Enviando…" : photos.length === 0 ? "Adicionar foto" : "Adicionar outra foto"}
          </Button>
        </>
      ) : null}

      {pointsEnabled ? <SessionPointsCard key={photos.length} sessionId={session.id} photoAction={false} /> : null}

      {error ? <FormAlert variant="error">{error}</FormAlert> : null}

      <div className={styles.actions}>
        {canEdit ? (
          <Button href={`/painel/treinos-realizados/${session.id}/editar`} variant="secondary" block>
            Editar registro
          </Button>
        ) : null}
        {canDelete ? (
          <Button type="button" variant="quiet" block onClick={() => setConfirm(true)} disabled={busy}>
            Excluir treino
          </Button>
        ) : null}
      </div>

      <Sheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Excluir este treino?"
        footer={
          <>
            <Button type="button" block onClick={() => void remove()} disabled={busy}>
              {busy ? "Excluindo…" : "Excluir treino"}
            </Button>
            <Button type="button" variant="quiet" block onClick={() => setConfirm(false)} disabled={busy}>
              Cancelar
            </Button>
          </>
        }
      >
        <p>As séries e as fotos saem do histórico. {pointsEnabled ? "Os pontos deste treino são estornados; desafio já encerrado não muda." : ""}</p>
      </Sheet>
    </div>
  );
}
