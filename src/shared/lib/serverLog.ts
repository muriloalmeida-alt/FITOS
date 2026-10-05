/// Logs estruturados para o Railway: uma linha JSON por evento, em stderr,
/// fácil de filtrar no painel (ex.: `"event":"request_error"`). Nunca
/// registra cookies, senhas, tokens ou valores de variáveis de ambiente.

const MAX = 4000;

function cut(value: unknown): unknown {
  return typeof value === "string" && value.length > MAX ? `${value.slice(0, MAX)}…` : value;
}

export function describeError(error: unknown): { name?: string; message: string; stack?: string; digest?: string; code?: string; cause?: string } {
  if (error instanceof Error) {
    const extra = error as Error & { digest?: unknown; code?: unknown };
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      digest: extra.digest !== undefined ? String(extra.digest) : undefined,
      code: extra.code !== undefined ? String(extra.code) : undefined,
      cause: error.cause !== undefined ? (error.cause instanceof Error ? `${error.cause.name}: ${error.cause.message}` : String(error.cause)) : undefined,
    };
  }
  return { message: String(error) };
}

export function logEvent(level: "info" | "warn" | "error", event: string, fields: Record<string, unknown> = {}): void {
  const entry: Record<string, unknown> = { level, event, time: new Date().toISOString(), commit: process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) };
  for (const [key, value] of Object.entries(fields)) entry[key] = cut(value);
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
