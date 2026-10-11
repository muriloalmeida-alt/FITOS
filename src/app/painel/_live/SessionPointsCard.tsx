"use client";

import { useEffect, useRef, useState } from "react";
import { resizeImage } from "@/shared/lib/resizeImage";
import { formatPoints } from "@/shared/lib/scoring";
import styles from "./SessionPointsCard.module.css";

interface Points {
  totalTenths: number;
  balancedTenths: number;
  status: "PENDENTE_FOTO" | "LIBERADO" | "CONTESTADO" | "MANTIDO" | "ANULADO";
  photoDeadline: string;
  items: { exerciseId: string; name: string; pointsTenths: number; source: string }[];
  countsIn?: { week: boolean; month: boolean };
  contest?: { status: "ABERTA" | "MANTIDO" | "ANULADO"; isAppeal: boolean; decision: string | null; canAppeal: boolean } | null;
  scoreId?: string;
}

const deadlineFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

/// Desafios (feature 3) no fim do treino: pontos calculados pelo servidor
/// e a foto que libera os pontos automaticamente. Sem pontuação (flag
/// desligada ou falha no cálculo), não aparece e não atrapalha o resumo.
/// `photoAction={false}`: a tela já tem a própria seção de fotos.
export function SessionPointsCard({ sessionId, photoAction = true }: { sessionId: string; photoAction?: boolean }) {
  const [points, setPoints] = useState<Points | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [appeal, setAppeal] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function load() {
    const response = await fetch(`/api/minhas-sessoes/${sessionId}/pontos`, { cache: "no-store" }).catch(() => null);
    const body = response?.ok ? ((await response.json().catch(() => null)) as { points: Points | null } | null) : null;
    setPoints(body?.points ?? null);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- leitura única dos pontos ao abrir o resumo
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só ao trocar de treino
  }, [sessionId]);

  async function sendPhoto(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const resized = await resizeImage(file, { max: 1600 });
      const form = new FormData();
      form.set("foto", resized.blob, "treino.jpg");
      form.set("largura", String(resized.width));
      form.set("altura", String(resized.height));
      const response = await fetch(`/api/minhas-sessoes/${sessionId}/evidencias`, { method: "POST", body: form });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.message ?? "Não foi possível enviar a foto. Tente de novo.");
      }
      await load();
    } catch {
      setError("Não foi possível enviar a foto. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  async function sendAppeal() {
    if (!points?.scoreId || appeal === null) return;
    setBusy(true);
    setError(null);
    const response = await fetch("/api/desafios/contestacoes/recurso", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scoreId: points.scoreId, reason: appeal }) }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      setError((await response?.json().catch(() => null))?.message ?? "Não foi possível enviar o recurso. Tente de novo.");
      return;
    }
    setAppeal(null);
    await load();
  }

  if (!points) return null;
  const pending = points.status === "PENDENTE_FOTO";
  const expired = pending && new Date(points.photoDeadline) < new Date();
  // Treino registrado depois que o desafio fechou: fica no histórico, sem mudar o resultado.
  const closed = points.countsIn ? !points.countsIn.week && !points.countsIn.month : false;
  const weekClosed = points.countsIn ? !points.countsIn.week && points.countsIn.month : false;

  return (
    <section className={styles.card} aria-label="Pontos do treino">
      <p className={styles.eyebrow}>Desafios</p>
      <p className={styles.total}>
        <strong>{formatPoints(points.totalTenths)}</strong> pontos
      </p>
      {closed ? <p className={styles.status}>Treino salvo no histórico. Este desafio já foi encerrado.</p> : null}
      {weekClosed ? <p className={styles.status}>A semana deste treino já foi encerrada: os pontos contam no mês.</p> : null}
      <p className={styles.status}>
        {points.status === "LIBERADO" || points.status === "MANTIDO"
          ? "✓ Pontos liberados"
          : points.status === "CONTESTADO"
            ? "Em contestação: os pontos continuam valendo até a decisão."
            : points.status === "ANULADO"
              ? "Pontos anulados após análise."
              : expired
                ? "Prazo da foto encerrado: o treino fica no histórico, sem pontos."
                : `Adicione uma foto até ${deadlineFmt.format(new Date(points.photoDeadline))} para receber os pontos.`}
      </p>
      {points.contest?.decision ? (
        <p className={styles.status}>
          {points.contest.status === "ANULADO" ? "Decisão: pontos anulados." : "Decisão: pontos mantidos."} “{points.contest.decision}”
        </p>
      ) : null}
      {points.contest?.status === "ABERTA" && points.contest.isAppeal ? <p className={styles.status}>Recurso em análise.</p> : null}
      {points.contest?.canAppeal && appeal === null ? (
        <button type="button" className={styles.toggle} onClick={() => setAppeal("")}>
          Recorrer da decisão
        </button>
      ) : null}
      {appeal !== null ? (
        <div className={styles.appeal}>
          <label>
            <span>Por que recorre?</span>
            <textarea value={appeal} maxLength={500} rows={3} onChange={(event) => setAppeal(event.target.value)} />
          </label>
          <button type="button" className={styles.photo} disabled={busy || appeal.trim().length < 5} onClick={() => void sendAppeal()}>
            {busy ? "Enviando…" : "Enviar recurso"}
          </button>
        </div>
      ) : null}
      {photoAction && pending && !expired && !closed ? (
        <>
          <input ref={input} type="file" accept="image/*" className={styles.hidden} aria-label="Foto do treino" onChange={(event) => void sendPhoto(event.target.files?.[0])} />
          <button type="button" className={styles.photo} onClick={() => input.current?.click()} disabled={busy}>
            {busy ? "Enviando…" : "Adicionar foto e liberar pontos"}
          </button>
        </>
      ) : null}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      <button type="button" className={styles.toggle} aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? "Esconder detalhes" : "Ver por exercício"}
      </button>
      {open ? (
        <ul className={styles.items}>
          {points.items.map((item) => (
            <li key={item.exerciseId}>
              <span>{item.name}</span>
              <strong>{formatPoints(item.pointsTenths)}</strong>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
