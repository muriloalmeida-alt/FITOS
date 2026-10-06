import "server-only";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { AuthError, requireSession } from "@/modules/tenancy/authContext";
import { sendToUser, type PushConfig, type Sender } from "@/modules/notifications/push";
import { chatCategoryLabel, isChatCategory, type ChatCategory } from "@/shared/lib/chatCategories";
import { logEvent, describeError } from "@/shared/lib/serverLog";

/// Chat entre aluno e personal (EPIC-39), organizado por assunto: cada
/// assunto tem uma categoria (e o exercício, quando é sobre um), as
/// mensagens e a situação (aberto/resolvido). Só dentro do vínculo: o
/// aluno fala com o personal do espaço dele; o personal, com os próprios
/// alunos. Cada mensagem nova avisa o outro lado no celular.

export class ChatError extends Error {
  constructor(
    public readonly kind: "VALIDACAO" | "NAO_ENCONTRADO",
    message: string
  ) {
    super(message);
    this.name = "ChatError";
  }
}

export type ChatViewer = { role: "PERSONAL"; userId: string; tenantId: string } | { role: "ALUNO"; userId: string; tenantId: string; studentId: string };

export async function requireChatViewer(): Promise<ChatViewer> {
  const ctx = await requireSession();
  if (ctx.role === "PERSONAL") return { role: "PERSONAL", userId: ctx.userId, tenantId: ctx.tenantId };
  if (ctx.role === "ALUNO" && ctx.tenantId && ctx.studentId) return { role: "ALUNO", userId: ctx.userId, tenantId: ctx.tenantId, studentId: ctx.studentId };
  throw new AuthError("FORBIDDEN", "As mensagens são entre aluno e personal.");
}

const MAX_BODY = 2000;

function cleanBody(body: unknown, optional = false): string {
  const text = typeof body === "string" ? body.trim() : "";
  if (!text && optional) return "";
  if (!text) throw new ChatError("VALIDACAO", "Escreva a mensagem.");
  if (text.length > MAX_BODY) throw new ChatError("VALIDACAO", `A mensagem pode ter até ${MAX_BODY} caracteres.`);
  return text;
}

function topicScope(viewer: ChatViewer) {
  return viewer.role === "ALUNO" ? { tenantId: viewer.tenantId, studentId: viewer.studentId } : { tenantId: viewer.tenantId };
}

export function topicTitle(topic: { category: string; exerciseName: string | null }): string {
  return topic.category === "EXERCICIO" && topic.exerciseName ? topic.exerciseName : chatCategoryLabel(topic.category);
}

export function attachmentLabel(kind: string): string {
  return kind === "VIDEO" ? "🎥 Vídeo" : "📷 Foto";
}

function messagePreview(message: { body: string; attachment: { kind: string } | null }): string {
  if (!message.attachment) return message.body;
  return message.body ? `${attachmentLabel(message.attachment.kind)} · ${message.body}` : attachmentLabel(message.attachment.kind);
}

export interface TopicSummary {
  id: string;
  category: string;
  title: string;
  studentId: string;
  studentName: string;
  studentImage: string | null;
  lastMessage: string;
  lastFromMe: boolean;
  lastMessageAt: Date;
  unread: boolean;
  resolved: boolean;
}

function isUnread(viewer: ChatViewer, topic: { lastStudentMessageAt: Date | null; lastPersonalMessageAt: Date | null; studentReadAt: Date | null; personalReadAt: Date | null }): boolean {
  const incoming = viewer.role === "ALUNO" ? topic.lastPersonalMessageAt : topic.lastStudentMessageAt;
  const read = viewer.role === "ALUNO" ? topic.studentReadAt : topic.personalReadAt;
  return incoming !== null && (read === null || incoming > read);
}

export async function listTopics(viewer: ChatViewer, filter: { category?: string | null; studentId?: string | null } = {}, client: PrismaClient = prisma): Promise<TopicSummary[]> {
  const topics = await client.chatTopic.findMany({
    where: { ...topicScope(viewer), ...(filter.category && isChatCategory(filter.category) ? { category: filter.category } : {}), ...(viewer.role === "PERSONAL" && filter.studentId ? { studentId: filter.studentId } : {}) },
    orderBy: { lastMessageAt: "desc" },
    take: 200,
    include: {
      student: { select: { displayName: true, user: { select: { image: true } } } },
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true, fromStudent: true, attachment: { select: { kind: true } } } },
    },
  });
  const rows = topics.map((topic) => ({
    id: topic.id,
    category: topic.category,
    title: topicTitle(topic),
    studentId: topic.studentId,
    studentName: topic.student.displayName,
    studentImage: topic.student.user?.image ?? null,
    lastMessage: topic.messages[0] ? messagePreview(topic.messages[0]) : "",
    lastFromMe: topic.messages[0] ? topic.messages[0].fromStudent === (viewer.role === "ALUNO") : false,
    lastMessageAt: topic.lastMessageAt,
    unread: isUnread(viewer, topic),
    resolved: topic.resolvedAt !== null,
  }));
  // Não lidas primeiro; depois abertas; depois o mais recente.
  return rows.sort((a, b) => Number(b.unread) - Number(a.unread) || Number(a.resolved) - Number(b.resolved) || b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
}

export async function unreadTopicsCount(viewer: ChatViewer, client: PrismaClient = prisma): Promise<number> {
  const topics = await client.chatTopic.findMany({
    where: { ...topicScope(viewer), ...(viewer.role === "ALUNO" ? { lastPersonalMessageAt: { not: null } } : { lastStudentMessageAt: { not: null } }) },
    select: { lastStudentMessageAt: true, lastPersonalMessageAt: true, studentReadAt: true, personalReadAt: true },
    take: 500,
  });
  return topics.filter((topic) => isUnread(viewer, topic)).length;
}

/// Exercícios do programa atual do aluno, para escolher no "Exercício".
export async function studentExercises(input: { tenantId: string; studentId: string }, client: PrismaClient = prisma): Promise<{ id: string; name: string; workoutName: string }[]> {
  const assignment = await client.planAssignment.findFirst({
    where: { tenantId: input.tenantId, studentId: input.studentId, active: true },
    select: { trainingPlan: { select: { workouts: { orderBy: { position: "asc" }, select: { name: true, workoutExercises: { orderBy: { position: "asc" }, select: { exercise: { select: { id: true, name: true } } } } } } } } },
  });
  const seen = new Set<string>();
  const out: { id: string; name: string; workoutName: string }[] = [];
  for (const workout of assignment?.trainingPlan.workouts ?? []) {
    for (const item of workout.workoutExercises) {
      if (seen.has(item.exercise.id)) continue;
      seen.add(item.exercise.id);
      out.push({ id: item.exercise.id, name: item.exercise.name, workoutName: workout.name });
    }
  }
  return out;
}

type PushDeps = { client?: PrismaClient; sender?: Sender; config?: PushConfig | null };

async function notify(topic: { id: string; category: string; exerciseName: string | null; tenantId: string; studentId: string }, fromStudent: boolean, body: string, deps: PushDeps) {
  const client = deps.client ?? prisma;
  try {
    const student = await client.student.findUniqueOrThrow({ where: { id: topic.studentId }, select: { displayName: true, userId: true, tenant: { select: { ownerId: true, owner: { select: { name: true } } } } } });
    const target = fromStudent ? student.tenant.ownerId : student.userId;
    if (!target) return;
    const sender = fromStudent ? student.displayName : student.tenant.owner.name;
    await sendToUser(
      target,
      { title: `${sender.trim().split(/\s+/)[0]} · ${topicTitle(topic)}`, body: body.length > 140 ? `${body.slice(0, 137)}…` : body, url: `/painel/mensagens/${topic.id}`, tag: `chat-${topic.id}` },
      { client, sender: deps.sender, config: deps.config }
    );
  } catch (error) {
    logEvent("error", "chat_push_failed", { topicId: topic.id, ...describeError(error) });
  }
}

/// Abre um assunto com a primeira mensagem. O aluno abre com o próprio
/// personal; o personal, com um aluno ativo do espaço.
export async function createTopic(
  viewer: ChatViewer,
  input: { category: unknown; body: unknown; exerciseId?: string | null; exerciseName?: string | null; studentId?: string | null },
  deps: PushDeps = {}
): Promise<{ id: string }> {
  const client = deps.client ?? prisma;
  if (!isChatCategory(input.category)) throw new ChatError("VALIDACAO", "Escolha sobre o que é a mensagem.");
  const category: ChatCategory = input.category;
  const body = cleanBody(input.body);
  const studentId = viewer.role === "ALUNO" ? viewer.studentId : input.studentId;
  if (!studentId) throw new ChatError("VALIDACAO", "Escolha o aluno.");
  const student = await client.student.findFirst({ where: { id: studentId, tenantId: viewer.tenantId, status: "ATIVO" }, select: { id: true } });
  if (!student) throw new ChatError("NAO_ENCONTRADO", "Aluno não encontrado.");

  let exerciseId: string | null = null;
  let exerciseName: string | null = null;
  if (category === "EXERCICIO" && input.exerciseId) {
    const exercise = await client.exercise.findFirst({ where: { id: input.exerciseId, OR: [{ tenantId: null }, { tenantId: viewer.tenantId }] }, select: { id: true, name: true } });
    if (!exercise) throw new ChatError("VALIDACAO", "Exercício não encontrado.");
    exerciseId = exercise.id;
    exerciseName = exercise.name;
  } else if (category === "EXERCICIO" && typeof input.exerciseName === "string" && input.exerciseName.trim()) {
    exerciseName = input.exerciseName.trim().slice(0, 120);
  }

  const now = new Date();
  const fromStudent = viewer.role === "ALUNO";
  const topic = await client.chatTopic.create({
    data: {
      tenantId: viewer.tenantId,
      studentId: student.id,
      category,
      exerciseId,
      exerciseName,
      lastMessageAt: now,
      ...(fromStudent ? { lastStudentMessageAt: now, studentReadAt: now } : { lastPersonalMessageAt: now, personalReadAt: now }),
      messages: { create: { tenantId: viewer.tenantId, authorUserId: viewer.userId, fromStudent, body, createdAt: now } },
    },
  });
  await notify(topic, fromStudent, body, deps);
  return { id: topic.id };
}

export interface TopicThread {
  id: string;
  category: string;
  title: string;
  studentId: string;
  studentName: string;
  personalName: string;
  resolved: boolean;
  messages: { id: string; body: string; mine: boolean; createdAt: Date; attachment: ThreadAttachment | null }[];
}

export interface ThreadAttachment {
  id: string;
  kind: "VIDEO" | "FOTO";
  durationSec: number | null;
  width: number | null;
  height: number | null;
  expired: boolean;
}

/// Abre o assunto e marca como lido para quem está vendo.
export async function getThread(viewer: ChatViewer, topicId: string, client: PrismaClient = prisma): Promise<TopicThread> {
  const topic = await client.chatTopic.findFirst({
    where: { id: topicId, ...topicScope(viewer) },
    include: {
      student: { select: { displayName: true, tenant: { select: { owner: { select: { name: true } } } } } },
      messages: { orderBy: { createdAt: "asc" }, take: 500, include: { attachment: { select: { id: true, kind: true, durationSec: true, width: true, height: true, expiredAt: true } } } },
    },
  });
  if (!topic) throw new ChatError("NAO_ENCONTRADO", "Conversa não encontrada.");
  await client.chatTopic.update({ where: { id: topic.id }, data: viewer.role === "ALUNO" ? { studentReadAt: new Date() } : { personalReadAt: new Date() } });
  const mineIsStudent = viewer.role === "ALUNO";
  return {
    id: topic.id,
    category: topic.category,
    title: topicTitle(topic),
    studentId: topic.studentId,
    studentName: topic.student.displayName,
    personalName: topic.student.tenant.owner.name,
    resolved: topic.resolvedAt !== null,
    messages: topic.messages.map((message) => ({
      id: message.id,
      body: message.body,
      mine: message.fromStudent === mineIsStudent,
      createdAt: message.createdAt,
      attachment: message.attachment
        ? { id: message.attachment.id, kind: message.attachment.kind === "VIDEO" ? "VIDEO" : "FOTO", durationSec: message.attachment.durationSec, width: message.attachment.width, height: message.attachment.height, expired: message.attachment.expiredAt !== null }
        : null,
    })),
  };
}

export interface NewAttachment {
  kind: "VIDEO" | "FOTO";
  mimeType: string;
  data: Uint8Array;
  durationSec?: number | null;
  width?: number | null;
  height?: number | null;
}

/// Responde no assunto, com texto e/ou um anexo (vídeo ou foto). Uma
/// mensagem nova reabre um assunto resolvido.
export async function postMessage(viewer: ChatViewer, topicId: string, rawBody: unknown, deps: PushDeps = {}, attachment?: NewAttachment): Promise<{ id: string }> {
  const client = deps.client ?? prisma;
  const body = cleanBody(rawBody, Boolean(attachment));
  const topic = await client.chatTopic.findFirst({ where: { id: topicId, ...topicScope(viewer) } });
  if (!topic) throw new ChatError("NAO_ENCONTRADO", "Conversa não encontrada.");
  const now = new Date();
  const fromStudent = viewer.role === "ALUNO";
  const [message] = await client.$transaction([
    client.chatMessage.create({
      data: {
        tenantId: topic.tenantId,
        topicId: topic.id,
        authorUserId: viewer.userId,
        fromStudent,
        body,
        createdAt: now,
        ...(attachment
          ? {
              attachment: {
                create: {
                  tenantId: topic.tenantId,
                  kind: attachment.kind,
                  mimeType: attachment.mimeType,
                  sizeBytes: attachment.data.length,
                  durationSec: attachment.durationSec ?? null,
                  width: attachment.width ?? null,
                  height: attachment.height ?? null,
                  data: Buffer.from(attachment.data),
                },
              },
            }
          : {}),
      },
    }),
    client.chatTopic.update({
      where: { id: topic.id },
      data: { lastMessageAt: now, resolvedAt: null, ...(fromStudent ? { lastStudentMessageAt: now, studentReadAt: now } : { lastPersonalMessageAt: now, personalReadAt: now }) },
    }),
  ]);
  await notify(topic, fromStudent, attachment ? messagePreview({ body, attachment }) : body, deps);
  return { id: message.id };
}

export async function setResolved(viewer: ChatViewer, topicId: string, resolved: boolean, client: PrismaClient = prisma): Promise<void> {
  const { count } = await client.chatTopic.updateMany({ where: { id: topicId, ...topicScope(viewer) }, data: { resolvedAt: resolved ? new Date() : null } });
  if (count === 0) throw new ChatError("NAO_ENCONTRADO", "Conversa não encontrada.");
}
