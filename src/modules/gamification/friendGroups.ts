import "server-only";
import { randomInt } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { consolidatesAt } from "@/shared/lib/medals";
import { isSeasonLength, rankSeason, seasonWindow, type FriendMode, type SeasonLength } from "@/shared/lib/ranking";
import { OFFICIAL_STATUSES } from "./sessionScoring";

/// Amigos (Desafios 4/4, ADR-019): grupo privado por convite entre quem
/// treina (aluno de qualquer personal e Livre), com temporadas de 7, 14 ou
/// 28 dias. Mostra só nome, foto do perfil e pontos. Conta treino feito
/// dentro da temporada, depois da entrada e antes da saída; quem sai para
/// de contar e perde a leitura.

export const MAX_MEMBERS = 50;
export const MAX_GROUPS_PER_USER = 10;
const NAME_MAX = 40;
/// Sem 0/O e 1/I/L, para ditar o código sem confusão.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export type FriendGroupErrorKind = "VALIDACAO" | "NAO_ENCONTRADO" | "PROIBIDO" | "CONFLITO";

export class FriendGroupError extends Error {
  constructor(
    public readonly kind: FriendGroupErrorKind,
    message: string
  ) {
    super(message);
    this.name = "FriendGroupError";
  }
}

/// Quem treina: usuário e o próprio escopo de treino (`requireSelfStudent`).
export interface FriendSelf {
  userId: string;
  tenantId: string;
  studentId: string;
}

function newCode(): string {
  return Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
}

export function normalizeInviteCode(value: unknown): string {
  return typeof value === "string" ? value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "") : "";
}

async function activeGroupCount(userId: string, client: PrismaClient) {
  return client.friendGroupMember.count({ where: { userId, leftAt: null } });
}

export async function createFriendGroup(self: FriendSelf, input: { name: unknown; mode: unknown; lengthDays: unknown }, client: PrismaClient = prisma, now = new Date()) {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (name.length < 2 || name.length > NAME_MAX) throw new FriendGroupError("VALIDACAO", `Dê um nome de 2 a ${NAME_MAX} letras ao grupo.`);
  if (input.mode !== "TOTAL" && input.mode !== "EQUILIBRADO") throw new FriendGroupError("VALIDACAO", "Escolha como os pontos contam.");
  if (!isSeasonLength(input.lengthDays)) throw new FriendGroupError("VALIDACAO", "A temporada tem 7, 14 ou 28 dias.");
  if ((await activeGroupCount(self.userId, client)) >= MAX_GROUPS_PER_USER) throw new FriendGroupError("CONFLITO", `Você já está em ${MAX_GROUPS_PER_USER} grupos. Saia de um para criar outro.`);
  const window = seasonWindow(now, input.lengthDays);
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await client.friendGroup.create({
        data: {
          name,
          mode: input.mode,
          inviteCode: newCode(),
          ownerUserId: self.userId,
          members: { create: { userId: self.userId, tenantId: self.tenantId, studentId: self.studentId, role: "ORGANIZADOR", joinedAt: now } },
          seasons: { create: { lengthDays: input.lengthDays, ...window } },
        },
      });
    } catch (error) {
      // Código repetido (raro): sorteia outro.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
    }
  }
  throw new FriendGroupError("CONFLITO", "Não foi possível criar o grupo. Tente de novo.");
}

/// O que aparece antes de entrar: nome, regra, temporada e quantos estão.
export async function previewInvite(code: unknown, client: PrismaClient = prisma, now = new Date()) {
  const group = await client.friendGroup.findUnique({
    where: { inviteCode: normalizeInviteCode(code) },
    select: { id: true, name: true, mode: true, _count: { select: { members: { where: { leftAt: null } } } }, seasons: { orderBy: { startsAt: "desc" }, take: 1, select: { lengthDays: true, startsAt: true, endsAt: true } } },
  });
  if (!group) return null;
  const season = group.seasons[0] ?? null;
  return { id: group.id, name: group.name, mode: group.mode as FriendMode, members: group._count.members, season: season && season.endsAt > now ? season : null };
}

export async function joinFriendGroup(self: FriendSelf, code: unknown, client: PrismaClient = prisma, now = new Date()): Promise<{ groupId: string }> {
  const group = await client.friendGroup.findUnique({ where: { inviteCode: normalizeInviteCode(code) }, select: { id: true } });
  if (!group) throw new FriendGroupError("NAO_ENCONTRADO", "Convite não encontrado. Confira o código.");
  const existing = await client.friendGroupMember.findUnique({ where: { groupId_userId: { groupId: group.id, userId: self.userId } } });
  if (existing && !existing.leftAt) return { groupId: group.id };
  if ((await activeGroupCount(self.userId, client)) >= MAX_GROUPS_PER_USER) throw new FriendGroupError("CONFLITO", `Você já está em ${MAX_GROUPS_PER_USER} grupos. Saia de um para entrar em outro.`);
  if ((await client.friendGroupMember.count({ where: { groupId: group.id, leftAt: null } })) >= MAX_MEMBERS) throw new FriendGroupError("CONFLITO", `O grupo já tem ${MAX_MEMBERS} pessoas.`);
  // Voltar recomeça a contagem (e passa a valer o escopo de treino de agora).
  await client.friendGroupMember.upsert({
    where: { groupId_userId: { groupId: group.id, userId: self.userId } },
    create: { groupId: group.id, userId: self.userId, tenantId: self.tenantId, studentId: self.studentId, role: "MEMBRO", joinedAt: now },
    update: { tenantId: self.tenantId, studentId: self.studentId, role: "MEMBRO", joinedAt: now, leftAt: null },
  });
  return { groupId: group.id };
}

async function activeMembership(self: Pick<FriendSelf, "userId">, groupId: string, client: PrismaClient) {
  const member = await client.friendGroupMember.findUnique({ where: { groupId_userId: { groupId, userId: self.userId } } });
  // Quem não é membro (ou saiu) não vê nada, nem se o grupo existe.
  if (!member || member.leftAt) throw new FriendGroupError("NAO_ENCONTRADO", "Grupo não encontrado.");
  return member;
}

/// Sair: para de contar e perde a leitura. O organizador passa a vez para
/// quem entrou há mais tempo.
export async function leaveFriendGroup(self: Pick<FriendSelf, "userId">, groupId: string, client: PrismaClient = prisma, now = new Date()): Promise<void> {
  const member = await activeMembership(self, groupId, client);
  await client.$transaction(async (tx) => {
    await tx.friendGroupMember.update({ where: { id: member.id }, data: { leftAt: now, role: "MEMBRO" } });
    if (member.role === "ORGANIZADOR") {
      const next = await tx.friendGroupMember.findFirst({ where: { groupId, leftAt: null }, orderBy: { joinedAt: "asc" } });
      if (next) await tx.friendGroupMember.update({ where: { id: next.id }, data: { role: "ORGANIZADOR" } });
    }
  });
}

/// Nova temporada: só o organizador, e só sem outra em andamento.
export async function startFriendSeason(self: Pick<FriendSelf, "userId">, groupId: string, lengthDays: unknown, client: PrismaClient = prisma, now = new Date()) {
  const member = await activeMembership(self, groupId, client);
  if (member.role !== "ORGANIZADOR") throw new FriendGroupError("PROIBIDO", "Só quem organiza o grupo começa uma temporada.");
  if (!isSeasonLength(lengthDays)) throw new FriendGroupError("VALIDACAO", "A temporada tem 7, 14 ou 28 dias.");
  const running = await client.friendSeason.findFirst({ where: { groupId, endsAt: { gt: now } } });
  if (running) throw new FriendGroupError("CONFLITO", "Já há uma temporada em andamento.");
  return client.friendSeason.create({ data: { groupId, lengthDays, ...seasonWindow(now, lengthDays as SeasonLength) } });
}

export interface FriendRankingRow {
  memberId: string;
  name: string;
  image: string | null;
  position: number;
  pointsTenths: number;
  counted: number;
  contested: boolean;
  left: boolean;
  isMe: boolean;
}

export interface FriendGroupView {
  id: string;
  name: string;
  mode: FriendMode;
  inviteCode: string;
  isOrganizer: boolean;
  members: number;
  season: { lengthDays: number; startsAt: Date; endsAt: Date; running: boolean } | null;
  rows: FriendRankingRow[];
}

/// Placar da temporada atual (ou da última encerrada). Período encerrado
/// leva só o que foi liberado até a consolidação (24 h depois do fim).
export async function getFriendGroup(self: Pick<FriendSelf, "userId">, groupId: string, client: PrismaClient = prisma, now = new Date()): Promise<FriendGroupView> {
  const me = await activeMembership(self, groupId, client);
  const group = await client.friendGroup.findUniqueOrThrow({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
      mode: true,
      inviteCode: true,
      seasons: { orderBy: { startsAt: "desc" }, take: 1 },
      members: { select: { id: true, userId: true, tenantId: true, studentId: true, joinedAt: true, leftAt: true, user: { select: { name: true, image: true } } } },
    },
  });
  const season = group.seasons[0] ?? null;
  const active = group.members.filter((member) => !member.leftAt);
  const base = { id: group.id, name: group.name, mode: group.mode as FriendMode, inviteCode: group.inviteCode, isOrganizer: me.role === "ORGANIZADOR", members: active.length };
  if (!season) return { ...base, season: null, rows: [] };

  // Quem saiu durante a temporada aparece sinalizado, com o que somou até sair.
  const inSeason = group.members.filter((member) => !member.leftAt || member.leftAt > season.startsAt);
  const scores = inSeason.length
    ? await client.sessionScore.findMany({
        where: {
          OR: inSeason.map((member) => ({ tenantId: member.tenantId, studentId: member.studentId })),
          status: { in: OFFICIAL_STATUSES },
          performedAt: { gte: season.startsAt, lt: season.endsAt },
          ...(now >= consolidatesAt({ end: season.endsAt }) ? { releasedAt: { lte: consolidatesAt({ end: season.endsAt }) } } : {}),
        },
        select: { tenantId: true, studentId: true, performedAt: true, totalTenths: true, balancedTenths: true, status: true },
      })
    : [];
  const memberOf = new Map(inSeason.map((member) => [`${member.tenantId}:${member.studentId}`, member.id]));
  const entries = scores.flatMap((score) => {
    const memberId = memberOf.get(`${score.tenantId}:${score.studentId}`);
    return memberId ? [{ memberId, performedAt: score.performedAt, totalTenths: score.totalTenths, balancedTenths: score.balancedTenths, contested: score.status === "CONTESTADO" }] : [];
  });
  const byId = new Map(inSeason.map((member) => [member.id, member]));
  const rows = rankSeason(base.mode, season, inSeason.map((member) => ({ memberId: member.id, joinedAt: member.joinedAt, leftAt: member.leftAt })), entries).map((row) => {
    const member = byId.get(row.memberId)!;
    return { ...row, name: member.user.name || "Participante", image: member.user.image, left: Boolean(member.leftAt), isMe: member.userId === self.userId };
  });
  return { ...base, season: { lengthDays: season.lengthDays, startsAt: season.startsAt, endsAt: season.endsAt, running: season.endsAt > now }, rows };
}

export interface FriendGroupSummary {
  id: string;
  name: string;
  mode: FriendMode;
  members: number;
  season: { lengthDays: number; startsAt: Date; endsAt: Date; running: boolean } | null;
  myPosition: number | null;
}

export async function listMyFriendGroups(self: Pick<FriendSelf, "userId">, client: PrismaClient = prisma, now = new Date()): Promise<FriendGroupSummary[]> {
  const memberships = await client.friendGroupMember.findMany({ where: { userId: self.userId, leftAt: null }, orderBy: { joinedAt: "desc" }, select: { groupId: true } });
  const result: FriendGroupSummary[] = [];
  for (const { groupId } of memberships) {
    const view = await getFriendGroup(self, groupId, client, now);
    result.push({
      id: view.id,
      name: view.name,
      mode: view.mode,
      members: view.members,
      season: view.season,
      myPosition: view.rows.find((row) => row.isMe)?.position ?? null,
    });
  }
  return result;
}
