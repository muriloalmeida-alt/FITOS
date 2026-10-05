import "server-only";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { formatCentsBRL } from "@/shared/lib/money";
import { nextChargeDate } from "@/modules/billing/nextCharge";
import { sendToUser, type PushConfig, type PushPayload, type Sender } from "./push";
import { localClock } from "./reminders";

/// Aviso de vencimento da assinatura FitOS (EPIC-34): o dono do espaço
/// (personal ou FitOS Livre) recebe um push 5 dias antes e no dia do
/// débito. Sem cartão cadastrado, a mesma mensagem pede para cadastrar —
/// sem cartão não há débito automático. Só a partir das 9h de Brasília, e
/// um aviso por vencimento e tipo (tabela `subscription_due_reminders`).

export type DueReminderKind = "5_DIAS" | "NO_DIA";
const SEND_FROM_HOUR = 9;

function dayNumber(dateKey: string): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  return Date.UTC(year!, month! - 1, day!) / 86_400_000;
}

function shortDate(dateKey: string): string {
  const [, month, day] = dateKey.split("-");
  return `${day}/${month}`;
}

export function dueReminderMessage(input: {
  kind: DueReminderKind;
  planName: string;
  priceCents: number;
  dueOn: string;
  card: { brand: string | null; last4: string } | null;
}): PushPayload {
  const amount = formatCentsBRL(input.priceCents);
  const card = input.card ? `no cartão ${input.card.brand ?? ""} •••• ${input.card.last4}`.replace("  ", " ") : null;
  const base = { url: "/painel/assinatura", tag: `vencimento-${input.dueOn}` };
  if (input.kind === "5_DIAS") {
    return card
      ? { ...base, title: "Sua assinatura vence em 5 dias", body: `${input.planName}: ${amount} no dia ${shortDate(input.dueOn)}, ${card}.` }
      : { ...base, title: "Sua assinatura vence em 5 dias", body: `${input.planName}: ${amount} no dia ${shortDate(input.dueOn)}. Você ainda não tem cartão cadastrado: cadastre agora para não perder o acesso.` };
  }
  return card
    ? { ...base, title: "Hoje é o dia do débito", body: `${input.planName}: ${amount} ${card}.` }
    : { ...base, title: "Sua assinatura vence hoje", body: `${input.planName}: ${amount}. Não há cartão cadastrado: cadastre agora para continuar usando o FitOS.` };
}

export async function runDueReminders(options: { now?: Date; client?: PrismaClient; sender?: Sender; config?: PushConfig | null } = {}): Promise<{ sent: number }> {
  const client = options.client ?? prisma;
  const clock = localClock(options.now ?? new Date());
  if (clock.hour < SEND_FROM_HOUR) return { sent: 0 };
  const today = dayNumber(clock.dateKey);

  const subscriptions = await client.saasSubscription.findMany({
    where: { status: "ATIVA", plan: { priceCents: { gt: 0 } }, tenant: { owner: { pushSubscriptions: { some: {} } } } },
    include: { plan: true, tenant: { select: { ownerId: true } } },
    take: 2000,
  });

  let sent = 0;
  for (const subscription of subscriptions) {
    const due = nextChargeDate(subscription, clock.dayStart);
    if (!due) continue;
    const dueOn = localClock(due).dateKey;
    const daysLeft = dayNumber(dueOn) - today;
    const kind: DueReminderKind | null = daysLeft === 5 ? "5_DIAS" : daysLeft === 0 ? "NO_DIA" : null;
    if (!kind) continue;

    try {
      await client.subscriptionDueReminder.create({ data: { tenantId: subscription.tenantId, dueOn, kind } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
      throw error;
    }
    const message = dueReminderMessage({
      kind,
      planName: subscription.plan.name,
      priceCents: subscription.plan.priceCents,
      dueOn,
      card: subscription.creditCardLast4 ? { brand: subscription.creditCardBrand, last4: subscription.creditCardLast4 } : null,
    });
    if ((await sendToUser(subscription.tenant.ownerId, message, { client, sender: options.sender, config: options.config })) > 0) sent += 1;
  }
  return { sent };
}
