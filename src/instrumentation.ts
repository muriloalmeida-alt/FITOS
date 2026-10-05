import type { Instrumentation } from "next";

/// Diagnóstico para os logs do Railway: na subida do servidor, confere
/// variáveis de ambiente (só presença, nunca valor), conexão com o banco e
/// migrações; em toda requisição com erro, registra rota, contexto e stack.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { runStartupDiagnostics } = await import("./shared/lib/startupDiagnostics");
  await runStartupDiagnostics();
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
};
