/// Envia o erro de uma error boundary para `/api/log/erro-cliente`, que o
/// grava nos logs do servidor. Silencioso se falhar.
export function reportClientError(boundary: string, error: Error & { digest?: string }): void {
  try {
    const body = JSON.stringify({ boundary, page: window.location.pathname + window.location.search, message: error.message, digest: error.digest, stack: error.stack });
    if (!navigator.sendBeacon?.("/api/log/erro-cliente", new Blob([body], { type: "application/json" }))) {
      void fetch("/api/log/erro-cliente", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => undefined);
    }
  } catch {
    // Nunca quebra a tela de erro.
  }
}
