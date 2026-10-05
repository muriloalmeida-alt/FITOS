import "server-only";
import { describeError, logEvent } from "@/shared/lib/serverLog";
import { pushConfig } from "./push";
import { runDueReminders } from "./reminders";

/// Agendador dos lembretes (EPIC-31): roda dentro do próprio servidor, a
/// cada 5 minutos — o Railway não tem cron e um serviço só para isso seria
/// custo à toa. Mais de uma instância não manda em dobro (ver
/// `runDueReminders`). Desliga com `PUSH_LEMBRETES=off` ou sem chaves VAPID.
const INTERVAL_MS = 5 * 60_000;
let started = false;

export function startReminderScheduler(): void {
  if (started || process.env.PUSH_LEMBRETES === "off" || process.env.NODE_ENV === "test") return;
  if (!pushConfig()) {
    logEvent("info", "push.desligado", { motivo: "VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY ausentes" });
    return;
  }
  started = true;
  const tick = async () => {
    try {
      const { sent } = await runDueReminders();
      if (sent > 0) logEvent("info", "push.lembretes", { enviados: sent });
    } catch (error) {
      logEvent("error", "push.lembretes_falhou", describeError(error));
    }
  };
  const timer = setInterval(() => void tick(), INTERVAL_MS);
  timer.unref?.();
  void tick();
}
