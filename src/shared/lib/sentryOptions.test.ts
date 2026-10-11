import { describe, expect, it } from "vitest";
import { scrubEvent, sentryOptions } from "./sentryOptions";

describe("Sentry sem dado pessoal (EPIC-49)", () => {
  it("tira cookies, cabeçalhos, corpo, query e dados do usuário", () => {
    const event = scrubEvent({
      request: { url: "https://app.fitos.test/painel/alunos/abc/saude?editar=1", cookies: { session: "x" }, headers: { authorization: "y" }, data: { answers: "ficha" }, query_string: "editar=1" },
      user: { id: "u1", email: "ana@example.test", ip_address: "1.2.3.4" },
    });
    expect(event).toEqual({ request: { url: "https://app.fitos.test/painel/alunos/abc/saude" }, user: { id: "u1" } });
  });

  it("opções: sem PII e sem tracing", () => {
    expect(sentryOptions("https://k@o.ingest.sentry.io/1", undefined)).toMatchObject({ dsn: "https://k@o.ingest.sentry.io/1", environment: "producao", sendDefaultPii: false, tracesSampleRate: 0 });
  });
});
