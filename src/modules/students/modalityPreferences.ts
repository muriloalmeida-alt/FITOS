import "server-only";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { modalityDivergence, parseModalities, storedModalities, type Modality } from "@/shared/lib/modalities";

/// Modalidades preferidas (proposta 11). Livre: no perfil do onboarding.
/// Aluno com personal: no próprio cadastro de aluno, para o personal usar
/// na prescrição. Nunca muda programa nem treino.

type Owner = { role: "INDIVIDUAL"; tenantId: string } | { role: "ALUNO"; tenantId: string; studentId: string };

export async function getMyModalities(owner: Owner, client: PrismaClient = prisma): Promise<Modality[]> {
  if (owner.role === "INDIVIDUAL") {
    const profile = await client.individualProfile.findUnique({ where: { tenantId: owner.tenantId }, select: { modalities: true } });
    return storedModalities(profile?.modalities);
  }
  const student = await client.student.findFirst({ where: { id: owner.studentId, tenantId: owner.tenantId }, select: { modalities: true } });
  return storedModalities(student?.modalities);
}

/// Valida (ids conhecidos, sem duplicatas, não vazia) e grava só na conta
/// da sessão. Lança `ModalityError` quando inválida.
export async function setMyModalities(owner: Owner, raw: unknown, client: PrismaClient = prisma): Promise<Modality[]> {
  const modalities = parseModalities(raw);
  if (owner.role === "INDIVIDUAL") {
    const updated = await client.individualProfile.updateMany({ where: { tenantId: owner.tenantId }, data: { modalities } });
    if (updated.count === 0) throw new Error("Perfil do FitOS Livre não encontrado.");
  } else {
    const updated = await client.student.updateMany({ where: { id: owner.studentId, tenantId: owner.tenantId }, data: { modalities } });
    if (updated.count === 0) throw new Error("Aluno não encontrado.");
  }
  return modalities;
}

export interface StudentModalitiesView {
  modalities: Modality[];
  /// Classificação do programa ativo (vazio = sem programa ou sem classificação).
  programModalities: Modality[];
  /// Modalidades do programa ativo fora das preferências, para revisar.
  divergence: Modality[];
}

/// Para o personal: só alunos do próprio espaço (o filtro por tenant é a
/// fronteira; outro espaço devolve `null`).
export async function getStudentModalities(input: { tenantId: string; studentId: string }, client: PrismaClient = prisma): Promise<StudentModalitiesView | null> {
  const student = await client.student.findFirst({
    where: { id: input.studentId, tenantId: input.tenantId },
    select: { modalities: true, planAssignments: { where: { active: true }, take: 1, select: { trainingPlan: { select: { modalities: true } } } } },
  });
  if (!student) return null;
  const modalities = storedModalities(student.modalities);
  const programModalities = storedModalities(student.planAssignments[0]?.trainingPlan.modalities);
  return { modalities, programModalities, divergence: modalityDivergence(programModalities, modalities) };
}
