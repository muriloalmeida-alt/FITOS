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
}

const deadlineFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

/// Desafios (feature 3) no fim do treino: pontos calculados pelo servidor
/// e a foto que libera os pontos automaticamente. Sem pontuação (flag
/// desligada ou falha no cálculo), não aparece e não atrapalha o resumo.
export function SessionPointsCard({ sessionId }: { sessionId: string }) {
  const [points, setPoints] = useState<Points | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
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
      {pending && !expired && !closed ? (
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
