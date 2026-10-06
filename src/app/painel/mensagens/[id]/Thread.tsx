"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, FormAlert } from "@/shared/ui";
import { requestJson } from "../../_workout-builder/apiClient";
import styles from "../Mensagens.module.css";

interface Props {
  topicId: string;
  resolved: boolean;
  backHref: string;
  studentHref: string | null;
  messages: { id: string; body: string; mine: boolean; createdAt: string }[];
}

const TZ = "America/Sao_Paulo";
const dayKey = (iso: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: TZ }).format(new Date(iso));
const dayLabel = (iso: string) => new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "numeric", month: "short", timeZone: TZ }).format(new Date(iso));
const hour = (iso: string) => new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(new Date(iso));

/// Polling leve enquanto a conversa está na tela: novas mensagens chegam
/// sem recarregar (o push avisa quando o app está fechado).
const POLL_MS = 8000;

export function Thread({ topicId, resolved, backHref, studentHref, messages }: Props) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView?.({ block: "end" });
  }, [messages.length]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [router]);

  async function send() {
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await requestJson(`/api/mensagens/${topicId}`, { method: "POST", body: JSON.stringify({ body }) });
      setBody("");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível enviar.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleResolved() {
    setError(null);
    try {
      await requestJson(`/api/mensagens/${topicId}`, { method: "PATCH", body: JSON.stringify({ resolved: !resolved }) });
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível concluir.");
    }
  }

  return (
    <div className={styles.thread}>
      <div className={styles.head}>
        <Link href={backHref} className={styles.back}>
          ← Mensagens
        </Link>
        <span className={styles.headActions}>
          {studentHref ? (
            <Link href={studentHref} className={styles.back}>
              Ver aluno
            </Link>
          ) : null}
          <Button type="button" variant="quiet" onClick={() => void toggleResolved()}>
            {resolved ? "Reabrir" : "Resolvido"}
          </Button>
        </span>
      </div>

      {messages.map((message, index) => {
        const newDay = index === 0 || dayKey(messages[index - 1]!.createdAt) !== dayKey(message.createdAt);
        return (
          <Fragment key={message.id}>
            {newDay ? <p className={styles.day}>{dayLabel(message.createdAt)}</p> : null}
            <p className={`${styles.bubble} ${message.mine ? styles.mine : styles.theirs}`}>
              {message.body}
              <span className={styles.stamp}>{hour(message.createdAt)}</span>
            </p>
          </Fragment>
        );
      })}
      {resolved ? <p className={styles.day}>Assunto resolvido. Uma nova mensagem reabre.</p> : null}
      {error ? <FormAlert>{error}</FormAlert> : null}
      <div ref={end} />

      <form
        className={styles.composer}
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <textarea
          aria-label="Mensagem"
          rows={1}
          maxLength={2000}
          value={body}
          placeholder="Escreva uma mensagem"
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && window.matchMedia?.("(min-width: 840px)").matches) {
              event.preventDefault();
              void send();
            }
          }}
        />
        <Button type="submit" disabled={busy || !body.trim()}>
          {busy ? "…" : "Enviar"}
        </Button>
      </form>
    </div>
  );
}
