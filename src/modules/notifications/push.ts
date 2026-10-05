import "server-only";
import webpush from "web-push";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { logEvent } from "@/shared/lib/serverLog";

/// Envio de notificações (EPIC-31, Web Push com chaves VAPID). Sem as
/// chaves configuradas, nada é enviado e nada quebra: as telas mostram que
/// o aviso não está disponível.

export interface PushPayload {
  title: string;
  body: string;
  /// Para onde o toque na notificação leva.
  url: string;
  /// Notificações com a mesma tag se substituem no aparelho.
  tag?: string;
}

export interface PushConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

export function pushConfig(): PushConfig | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:contato@fitos.app";
  return { publicKey, privateKey, subject };
}

export interface SubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export function isSubscriptionInput(value: unknown): value is SubscriptionInput {
  if (!value || typeof value !== "object") return false;
  const v = value as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  return typeof v.endpoint === "string" && /^https:\/\//.test(v.endpoint) && v.endpoint.length < 2000 && typeof v.keys?.p256dh === "string" && typeof v.keys?.auth === "string";
}

/// Guarda (ou move para este usuário) a inscrição do aparelho.
export async function saveSubscription(input: { userId: string; subscription: SubscriptionInput; userAgent: string | null }, client: PrismaClient = prisma): Promise<void> {
  const data = { userId: input.userId, p256dh: input.subscription.keys.p256dh, auth: input.subscription.keys.auth, userAgent: input.userAgent?.slice(0, 300) ?? null };
  await client.pushSubscription.upsert({ where: { endpoint: input.subscription.endpoint }, create: { endpoint: input.subscription.endpoint, ...data }, update: data });
}

export async function removeSubscription(input: { userId: string; endpoint: string }, client: PrismaClient = prisma): Promise<void> {
  await client.pushSubscription.deleteMany({ where: { userId: input.userId, endpoint: input.endpoint } });
}

export type Sender = (subscription: { endpoint: string; keys: { p256dh: string; auth: string } }, payload: string, config: PushConfig) => Promise<void>;

const webPushSender: Sender = async (subscription, payload, config) => {
  await webpush.sendNotification(subscription, payload, { vapidDetails: config, TTL: 60 * 60 * 6 });
};

/// Manda para todos os aparelhos do usuário. Devolve quantos receberam.
/// Aparelho que o serviço diz não existir mais (404/410) é apagado.
export async function sendToUser(userId: string, payload: PushPayload, options: { client?: PrismaClient; sender?: Sender; config?: PushConfig | null } = {}): Promise<number> {
  const client = options.client ?? prisma;
  const config = options.config === undefined ? pushConfig() : options.config;
  if (!config) return 0;
  const sender = options.sender ?? webPushSender;
  const subscriptions = await client.pushSubscription.findMany({ where: { userId } });
  let delivered = 0;
  for (const subscription of subscriptions) {
    try {
      await sender({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify(payload), config);
      delivered += 1;
      await client.pushSubscription.update({ where: { id: subscription.id }, data: { lastSentAt: new Date() } });
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await client.pushSubscription.delete({ where: { id: subscription.id } }).catch(() => undefined);
      } else {
        logEvent("warn", "push.falhou", { userId, status: status ?? null, message: error instanceof Error ? error.message : String(error) });
      }
    }
  }
  return delivered;
}
