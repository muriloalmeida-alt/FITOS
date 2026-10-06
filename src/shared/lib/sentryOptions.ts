/// Monitoramento de erros (EPIC-49): opções do Sentry comuns ao servidor e
/// ao navegador. Sem DSN, nada é carregado. Nunca manda dado pessoal:
/// sem PII, sem cookies, cabeçalhos, corpo ou query string das requisições
/// (há dados de saúde e pagamento no app) — só o erro, a rota e a versão.

type SentryEvent = { request?: { cookies?: unknown; headers?: unknown; data?: unknown; query_string?: unknown; url?: string }; user?: { id?: string | number } & Record<string, unknown> };

export function scrubEvent<T extends SentryEvent>(event: T): T {
  if (event.request) {
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.data;
    delete event.request.query_string;
    if (event.request.url) event.request.url = event.request.url.split("?")[0];
  }
  if (event.user) event.user = event.user.id ? { id: event.user.id } : {};
  return event;
}

export function sentryOptions(dsn: string, environment: string | undefined) {
  return {
    dsn,
    environment: environment || "producao",
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend: scrubEvent,
  };
}
