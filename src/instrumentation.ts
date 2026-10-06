import type { Instrumentation } from "next";

/// Diagnóstico para os logs do Railway: na subida do servidor, confere
/// variáveis de ambiente (só presença, nunca valor), conexão com o banco e
/// migrações; em toda requisição com erro, registra rota, contexto e stack.
/// Também liga o agendador dos lembretes de treino (EPIC-31) e, com
/// `SENTRY_DSN`, o monitoramento de erros (EPIC-49).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // EPIC-49: monitoramento de erros, só com SENTRY_DSN.
  if (process.env.SENTRY_DSN) {
    const [Sentry, { sentryOptions }] = await Promise.all([import("@sentry/nextjs"), import("./shared/lib/sentryOptions")]);
    Sentry.init(sentryOptions(process.env.SENTRY_DSN, process.env.SENTRY_ENVIRONMENT ?? process.env.RAILWAY_ENVIRONMENT_NAME));
  }
  const { runStartupDiagnostics } = await import("./shared/lib/startupDiagnostics");
  await runStartupDiagnostics();
  // EPIC-31: lembretes de treino por push.
  const { startReminderScheduler } = await import("./modules/notifications/scheduler");
  startReminderScheduler();
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const { describeError, logEvent } = await import("./shared/lib/serverLog");
  logEvent("error", "request_error", {
    method: request.method,
    path: request.path,
    routePath: context.routePath,
    routeType: context.routeType,
    renderSource: context.renderSource,
    ...describeError(error),
  });
  if (process.env.SENTRY_DSN && process.env.NEXT_RUNTIME === "nodejs") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureRequestError(error, request, context);
  }
};
