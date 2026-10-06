"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, FormAlert, Sheet, useToast } from "@/shared/ui";
import { requestJson } from "../_workout-builder/apiClient";
import styles from "./LiveWorkout.module.css";

/// "Perguntar ao personal" no treino ao vivo (EPIC-39): abre um assunto
/// "Exercício" já com o exercício da tela, sem sair do treino.
export function AskCoach({ exerciseId, exerciseName, coachName }: { exerciseId: string; exerciseName: string; coachName: string }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const first = coachName.trim().split(/\s+/)[0] || "personal";

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const topic = await requestJson<{ id: string }>("/api/mensagens", { method: "POST", body: JSON.stringify({ category: "EXERCICIO", exerciseId, body }) });
      setSent(topic.id);
      setBody("");
      setOpen(false);
      toast.show(`Enviado para ${first}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível enviar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={styles.busyLink}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        Perguntar a {first}
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={`Pergunta sobre ${exerciseName}`}
        description={`${first} recebe no celular e responde em Mensagens. Pode seguir o treino.`}
        footer={
          <Button type="button" block disabled={busy || !body.trim()} onClick={() => void send()}>
            {busy ? "Enviando…" : "Enviar"}
          </Button>
        }
      >
        <div className={styles.busyList}>
          <textarea className={styles.askField} aria-label="Mensagem" rows={4} maxLength={2000} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Ex.: senti no ombro na descida, a pegada está certa?" />
          {sent ? (
            <Link href={`/painel/mensagens/${sent}`} className={styles.busyLink}>
              Ver a conversa anterior
            </Link>
          ) : null}
          {error ? <FormAlert>{error}</FormAlert> : null}
        </div>
      </Sheet>
    </>
  );
}
