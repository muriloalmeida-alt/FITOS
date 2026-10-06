/// Envia o erro de uma error boundary para `/api/log/erro-cliente`, que o
/// grava nos logs do servidor (e para o Sentry, quando ligado). Silencioso
/// se falhar.
export function reportClientError(boundary: string, error: Error & { digest?: string }): void {
  try {
    // EPIC-49: também para o Sentry, quando ligado (instrumentation-client).
    (window as unknown as { __fitosSentry?: { captureException: (error: unknown, hint?: unknown) => void } }).__fitosSentry?.captureException(error, { tags: { boundary } });
  } catch {
    // Sentry indisponível: segue só com o log.
  }
  try {
    const body = JSON.stringify({ boundary, page: window.location.pathname + window.location.search, message: error.message, digest: error.digest, stack: error.stack });
    if (!navigator.sendBeacon?.("/api/log/erro-cliente", new Blob([body], { type: "application/json" }))) {
      void fetch("/api/log/erro-cliente", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => undefined);
    }
  } catch {
    // Nunca quebra a tela de erro.
  }
}
