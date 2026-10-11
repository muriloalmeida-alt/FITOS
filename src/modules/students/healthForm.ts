import "server-only";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { sendToUser, type PushConfig, type Sender } from "@/modules/notifications/push";
import { describeError, logEvent } from "@/shared/lib/serverLog";
import { ACTIVITY_LEVELS, HEALTH_CONDITIONS, PARQ_QUESTIONS, type ActivityLevel, type HealthAnswers } from "@/shared/lib/healthForm";

/// Ficha de saúde (EPIC-46): o aluno responde (ou o personal preenche por
/// ele); o personal vê, com o alerta quando há "sim" no PAR-Q.

export class HealthFormError extends Error {
  constructor(
    public readonly kind: "VALIDACAO" | "NAO_ENCONTRADO",
    message: string
  ) {
    super(message);
    this.name = "HealthFormError";
  }
}

const MAX_TEXT = 1000;

function text(value: unknown, label: string): string {
  const out = typeof value === "string" ? value.trim() : "";
  if (out.length > MAX_TEXT) throw new HealthFormError("VALIDACAO", `${label}: até ${MAX_TEXT} caracteres.`);
  return out;
}

export function cleanAnswers(raw: unknown): HealthAnswers {
  const body = (raw ?? {}) as Record<string, unknown>;
  const parq = Array.isArray(body.parq) ? body.parq : [];
  if (parq.length !== PARQ_QUESTIONS.length || parq.some((value) => typeof value !== "boolean")) throw new HealthFormError("VALIDACAO", "Responda todas as perguntas de sim ou não.");
  const keys = new Set<string>(HEALTH_CONDITIONS.map((item) => item.key));
  const conditions = Array.isArray(body.conditions) ? [...new Set(body.conditions.filter((value): value is string => typeof value === "string" && keys.has(value)))] : [];
  const activity = ACTIVITY_LEVELS.some((item) => item.key === body.activity) ? (body.activity as ActivityLevel) : null;
  if (!activity) throw new HealthFormError("VALIDACAO", "Conte como está sua rotina de exercícios.");
  return {
    parq: parq as boolean[],
    conditions,
    injuries: text(body.injuries, "Lesões e cirurgias"),
    medications: text(body.medications, "Remédios"),
    pain: text(body.pain, "Dores"),
    activity,
    notes: text(body.notes, "Observações"),
  };
}

export interface HealthFormView {
  answers: HealthAnswers;
  parqYes: number;
  updatedAt: Date;
  filledBySelf: boolean;
}

export async function getHealthForm(scope: { tenantId: string; studentId: string }, client: PrismaClient = prisma): Promise<HealthFormView | null> {
  const form = await client.healthForm.findFirst({ where: { tenantId: scope.tenantId, studentId: scope.studentId }, include: { student: { select: { userId: true } } } });
  if (!form) return null;
  return { answers: form.answers as unknown as HealthAnswers, parqYes: form.parqYes, updatedAt: form.updatedAt, filledBySelf: form.filledByUserId === form.student.userId };
}

/// Salva a ficha (substitui a anterior). Quando é o aluno quem responde,
/// avisa o personal no celular.
export async function saveHealthForm(
  input: { tenantId: string; studentId: string; actorUserId: string; answers: unknown },
  deps: { client?: PrismaClient; sender?: Sender; config?: PushConfig | null } = {}
): Promise<HealthFormView> {
  const client = deps.client ?? prisma;
  const student = await client.student.findFirst({ where: { id: input.studentId, tenantId: input.tenantId }, select: { id: true, userId: true, displayName: true, tenant: { select: { ownerId: true } } } });
  if (!student) throw new HealthFormError("NAO_ENCONTRADO", "Aluno não encontrado.");
  const answers = cleanAnswers(input.answers);
  const parqYes = answers.parq.filter(Boolean).length;
  const data = { answers: answers as unknown as object, parqYes, filledByUserId: input.actorUserId };
  const saved = await client.healthForm.upsert({ where: { studentId: student.id }, create: { tenantId: input.tenantId, studentId: student.id, ...data }, update: data });
  const bySelf = input.actorUserId === student.userId;
  if (bySelf) {
    try {
      const first = student.displayName.trim().split(/\s+/)[0];
      await sendToUser(
        student.tenant.ownerId,
        { title: `${first} respondeu a ficha de saúde`, body: parqYes > 0 ? `${parqYes} ${parqYes === 1 ? "resposta pede" : "respostas pedem"} atenção no PAR-Q.` : "Nenhum alerta no PAR-Q.", url: `/painel/alunos/${student.id}/saude`, tag: `saude-${student.id}` },
        { client, sender: deps.sender, config: deps.config }
      );
    } catch (error) {
      logEvent("error", "ficha_saude_push_falhou", { studentId: student.id, ...describeError(error) });
    }
  }
  return { answers, parqYes, updatedAt: saved.updatedAt, filledBySelf: bySelf };
}
