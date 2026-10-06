"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, FormAlert } from "@/shared/ui";
import { requestJson } from "../_workout-builder/apiClient";
import styles from "./LiveWorkout.module.css";

/// Comentário depois do treino (EPIC-42): o aluno conta como foi e vira
/// uma conversa "Treino" com o personal, já com o esforço e o tempo.
export function WorkoutComment({ sessionId, coachName }: { sessionId: string; coachName: string }) {
  const first = coachName.trim().split(/\s+/)[0] || "personal";
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topicId, setTopicId] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const topic = await requestJson<{ id: string }>("/api/mensagens/comentario-treino", { method: "POST", body: JSON.stringify({ sessionId, body }) });
      setTopicId(topic.id);
      setBody("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível enviar.");
    } finally {
      setBusy(false);
    }
  }

  if (topicId) {
    return (
      <p className={styles.commentSent} role="status">
        Enviado para {first}.{" "}
        <Link href={`/painel/mensagens/${topicId}`} className={styles.link}>
          Ver conversa →
        </Link>
      </p>
    );
  }

  return (
    <div className={styles.comment}>
      <label className={styles.cap} htmlFor="comentario-treino">
        Quer contar algo para {first}?
      </label>
      <textarea
        id="comentario-treino"
        className={styles.askField}
        rows={2}
        maxLength={2000}
        value={body}
        placeholder="Ex.: o supino pesou, senti o joelho no agachamento…"
        onChange={(event) => setBody(event.target.value)}
      />
      {body.trim() ? (
        <Button type="button" variant="secondary" block disabled={busy} onClick={() => void send()}>
          {busy ? "Enviando…" : `Enviar para ${first}`}
        </Button>
      ) : null}
      {error ? <FormAlert>{error}</FormAlert> : null}
    </div>
  );
}
