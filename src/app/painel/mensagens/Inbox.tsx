"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ActionRow, Avatar, Button, ChipGroup, FormAlert, Sheet, Tag } from "@/shared/ui";
import { CHAT_CATEGORIES, chatCategoryLabel, type ChatCategory } from "@/shared/lib/chatCategories";
import { requestJson } from "../_workout-builder/apiClient";
import styles from "./Mensagens.module.css";

export interface InboxTopic {
  id: string;
  category: string;
  title: string;
  studentId: string;
  studentName: string;
  studentImage: string | null;
  lastMessage: string;
  lastFromMe: boolean;
  lastMessageAt: string;
  unread: boolean;
  resolved: boolean;
}

interface Props {
  role: "PERSONAL" | "ALUNO";
  topics: InboxTopic[];
  category: string | null;
  studentId: string | null;
  students: { id: string; name: string }[];
  exercises: { id: string; name: string; workoutName: string }[];
  startNew?: boolean;
}

export function relativeTime(iso: string, now = Date.now()): string {
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "ontem";
  if (days < 7) return `${days} dias`;
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", timeZone: "America/Sao_Paulo" }).format(new Date(iso));
}

/// Caixa de mensagens (EPIC-39): assuntos com categoria, não lidos primeiro,
/// filtro por categoria e "Nova mensagem" (categoria → exercício, se for o
/// caso → texto).
export function Inbox({ role, topics, category, studentId, students, exercises, startNew = false }: Props) {
  const router = useRouter();
  const personal = role === "PERSONAL";
  const [open, setOpen] = useState(startNew);
  const [newCategory, setNewCategory] = useState<ChatCategory | null>(null);
  const [exerciseId, setExerciseId] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(studentId);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const base = (next: string | null) => {
    const params = new URLSearchParams();
    if (next) params.set("categoria", next);
    if (studentId) params.set("aluno", studentId);
    const query = params.toString();
    return `/painel/mensagens${query ? `?${query}` : ""}`;
  };

  function openNew() {
    setNewCategory(null);
    setExerciseId(null);
    setTo(studentId);
    setBody("");
    setError(null);
    setOpen(true);
  }

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const topic = await requestJson<{ id: string }>("/api/mensagens", { method: "POST", body: JSON.stringify({ category: newCategory, exerciseId, body, studentId: personal ? to : undefined }) });
      router.push(`/painel/mensagens/${topic.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível enviar.");
      setBusy(false);
    }
  }

  const ready = newCategory !== null && body.trim().length > 0 && (!personal || to !== null);

  return (
    <div className={styles.inbox}>
      <Button type="button" block onClick={openNew}>
        {personal && studentId ? `Nova mensagem para ${students.find((student) => student.id === studentId)?.name.split(/\s+/)[0] ?? "o aluno"}` : "Nova mensagem"}
      </Button>

      <nav className={styles.filters} aria-label="Categorias">
        {[{ key: null, label: "Todas" }, ...CHAT_CATEGORIES.map((entry) => ({ key: entry.key as string | null, label: entry.label }))].map((entry) => (
          <Link key={entry.key ?? "todas"} href={base(entry.key)} className={styles.filter} aria-current={(category ?? null) === entry.key ? "page" : undefined} replace scroll={false}>
            {entry.label}
          </Link>
        ))}
      </nav>

      {topics.length === 0 ? (
        <p className={styles.empty}>{category ? "Nenhuma conversa nesta categoria." : personal ? "Quando um aluno mandar uma mensagem, ela aparece aqui." : "Tire dúvidas sobre um exercício, conte como foi o treino ou avise de um imprevisto."}</p>
      ) : (
        <ul className={styles.list}>
          {topics.map((topic) => (
            <li key={topic.id}>
              <ActionRow
                href={`/painel/mensagens/${topic.id}`}
                leading={personal ? <Avatar name={topic.studentName} src={topic.studentImage} /> : <span className={styles.categoryIcon}>{chatCategoryLabel(topic.category).charAt(0)}</span>}
                title={
                  <span className={topic.unread ? styles.unreadTitle : undefined}>
                    {personal ? `${topic.studentName.split(/\s+/)[0]} · ${topic.title}` : topic.title} {topic.unread ? <Tag tone="warn">Nova</Tag> : topic.resolved ? <Tag tone="ok">Resolvido</Tag> : null}
                  </span>
                }
                description={`${topic.lastFromMe ? "Você: " : ""}${topic.lastMessage}`}
                trailing={<span className={styles.time}>{relativeTime(topic.lastMessageAt, now)}</span>}
              />
            </li>
          ))}
        </ul>
      )}

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Nova mensagem"
        description={personal ? "Escolha o aluno e o assunto." : "Sobre o que você quer falar?"}
        footer={
          <Button type="button" block disabled={!ready || busy} onClick={() => void send()}>
            {busy ? "Enviando…" : "Enviar"}
          </Button>
        }
      >
        <div className={styles.stack}>
          {personal && !studentId ? (
            students.length === 0 ? (
              <p className={styles.empty}>Nenhum aluno ativo ainda.</p>
            ) : (
              <ChipGroup label="Aluno" showLabel value={to} onChange={setTo} options={students.map((student) => ({ value: student.id, label: student.name.split(/\s+/)[0] }))} />
            )
          ) : null}
          <ChipGroup label="Assunto" showLabel variant="card" columns={2} value={newCategory} onChange={(value) => { setNewCategory(value); setExerciseId(null); }} options={CHAT_CATEGORIES.map((entry) => ({ value: entry.key, label: entry.label, description: entry.hint }))} />
          {newCategory === "EXERCICIO" && !personal && exercises.length > 0 ? (
            <ChipGroup label="Qual exercício?" showLabel variant="scroll" value={exerciseId} onChange={setExerciseId} options={exercises.map((exercise) => ({ value: exercise.id, label: exercise.name }))} />
          ) : null}
          <label className={styles.field}>
            <span>Mensagem</span>
            <textarea rows={4} maxLength={2000} value={body} onChange={(event) => setBody(event.target.value)} placeholder={newCategory === "DOR" ? "Onde dói, em qual exercício e quando começou." : "Escreva aqui"} />
          </label>
          {error ? <FormAlert>{error}</FormAlert> : null}
        </div>
      </Sheet>
    </div>
  );
}
