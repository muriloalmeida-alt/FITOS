"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, FormAlert } from "@/shared/ui";
import { requestJson } from "../../_workout-builder/apiClient";
import { resizeImage } from "@/shared/lib/resizeImage";
import { QuickReplies } from "./QuickReplies";
import styles from "../Mensagens.module.css";

interface Props {
  topicId: string;
  resolved: boolean;
  backHref: string;
  studentHref: string | null;
  messages: { id: string; body: string; mine: boolean; createdAt: string; attachment: Attachment | null }[];
  /// Texto de ajuda do anexo (o aluno grava a execução).
  attachHint?: string;
  /// Respostas rápidas (só o personal).
  quickReplies?: string[];
}

export interface Attachment {
  id: string;
  kind: "VIDEO" | "FOTO";
  durationSec: number | null;
  width: number | null;
  height: number | null;
  expired: boolean;
}

const VIDEO_MAX_BYTES = 40 * 1024 * 1024;
const VIDEO_MAX_SECONDS = 90;

function videoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    const done = (value: number | null) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    video.onloadedmetadata = () => done(Number.isFinite(video.duration) ? video.duration : null);
    video.onerror = () => done(null);
    setTimeout(() => done(null), 5000);
    video.src = url;
  });
}

/// Upload com progresso (o fetch não mostra quanto já foi).
function upload(url: string, form: FormData, onProgress: (ratio: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", url);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) return resolve();
      let message = "Não foi possível enviar.";
      try {
        message = (JSON.parse(request.responseText) as { message?: string }).message ?? message;
      } catch {}
      reject(new Error(message));
    };
    request.onerror = () => reject(new Error("Sem conexão. Tente de novo."));
    request.send(form);
  });
}

function AttachmentView({ attachment }: { attachment: Attachment }) {
  if (attachment.expired) return <span className={styles.expired}>{attachment.kind === "VIDEO" ? "Vídeo" : "Foto"} expirado (mais de 90 dias)</span>;
  const src = `/api/mensagens/anexos/${attachment.id}`;
  if (attachment.kind === "VIDEO") return <video className={styles.media} src={src} controls playsInline preload="metadata" />;
  // eslint-disable-next-line @next/next/no-img-element -- foto privada servida por rota autenticada; next/image não serve aqui
  return <img className={styles.media} src={src} alt="Foto enviada na conversa" width={attachment.width ?? undefined} height={attachment.height ?? undefined} loading="lazy" />;
}

const TZ = "America/Sao_Paulo";
const dayKey = (iso: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: TZ }).format(new Date(iso));
const dayLabel = (iso: string) => new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "numeric", month: "short", timeZone: TZ }).format(new Date(iso));
const hour = (iso: string) => new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(new Date(iso));

/// Polling leve enquanto a conversa está na tela: novas mensagens chegam
/// sem recarregar (o push avisa quando o app está fechado).
const POLL_MS = 8000;

export function Thread({ topicId, resolved, backHref, studentHref, messages, attachHint, quickReplies }: Props) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);

  async function attach(file: File) {
    setError(null);
    const form = new FormData();
    try {
      if (file.type.startsWith("image/")) {
        const { blob, width, height } = await resizeImage(file, { max: 1600 });
        form.set("file", blob, "foto.jpg");
        form.set("width", String(width));
        form.set("height", String(height));
      } else {
        if (file.size > VIDEO_MAX_BYTES) throw new Error("Vídeo grande demais. Grave até 30 segundos, só a execução.");
        const seconds = await videoDuration(file);
        if (seconds !== null && seconds > VIDEO_MAX_SECONDS) throw new Error(`O vídeo pode ter até ${VIDEO_MAX_SECONDS} segundos.`);
        form.set("file", file);
        if (seconds !== null) form.set("durationSec", String(Math.round(seconds)));
      }
      form.set("caption", body);
      setProgress(0);
      await upload(`/api/mensagens/${topicId}/anexo`, form, setProgress);
      setBody("");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível enviar.");
    } finally {
      setProgress(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

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
            <div className={`${styles.bubble} ${message.mine ? styles.mine : styles.theirs}${message.attachment ? ` ${styles.withMedia}` : ""}`}>
              {message.attachment ? <AttachmentView attachment={message.attachment} /> : null}
              {message.body ? <span>{message.body}</span> : null}
              <span className={styles.stamp}>{hour(message.createdAt)}</span>
            </div>
          </Fragment>
        );
      })}
      {resolved ? <p className={styles.day}>Assunto resolvido. Uma nova mensagem reabre.</p> : null}
      {progress !== null ? (
        <p className={styles.day} role="status">
          Enviando… {Math.round(progress * 100)}%
        </p>
      ) : null}
      {error ? <FormAlert>{error}</FormAlert> : null}
      {attachHint && messages.every((message) => !message.attachment) ? <p className={styles.hint}>{attachHint}</p> : null}
      <div ref={end} />

      <form
        className={styles.composer}
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <input
          ref={fileInput}
          type="file"
          accept="video/*,image/*"
          hidden
          aria-label="Vídeo ou foto"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void attach(file);
          }}
        />
        <button type="button" className={styles.attach} aria-label="Enviar vídeo ou foto" disabled={progress !== null} onClick={() => fileInput.current?.click()}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 10l4.55-2.28A1 1 0 0 1 21 8.62v6.76a1 1 0 0 1-1.45.9L15 14" />
            <rect x="3" y="6" width="12" height="12" rx="2" />
          </svg>
        </button>
        {quickReplies ? <QuickReplies replies={quickReplies} disabled={progress !== null} onPick={(text) => setBody((current) => (current.trim() ? `${current.trim()} ${text}` : text))} /> : null}
        <textarea
          aria-label="Mensagem"
          rows={1}
          maxLength={2000}
          value={body}
          placeholder="Mensagem"
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && window.matchMedia?.("(min-width: 840px)").matches) {
              event.preventDefault();
              void send();
            }
          }}
        />
        <button type="submit" className={styles.send} aria-label="Enviar" disabled={busy || !body.trim()}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </form>
    </div>
  );
}
