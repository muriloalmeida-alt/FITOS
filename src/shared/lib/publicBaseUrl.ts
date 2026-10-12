/// Endereço público do app para links que saem do FitOS (WhatsApp, convite
/// copiado). Usa o endereço pelo qual a pessoa acessou (proxy do Railway:
/// `x-forwarded-host`/`x-forwarded-proto`). `BETTER_AUTH_URL` só vale quando
/// não aponta para localhost num acesso público, o que deixaria o link
/// quebrado fora da máquina de desenvolvimento.

const LOCAL = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?$/i;

export function resolvePublicBaseUrl(input: { configured?: string | null; forwardedHost?: string | null; host?: string | null; forwardedProto?: string | null }): string {
  const host = (input.forwardedHost ?? input.host ?? "").split(",")[0]!.trim();
  const configured = input.configured?.trim().replace(/\/$/, "") || null;
  const configuredHost = configured ? (() => { try { return new URL(configured).host; } catch { return null; } })() : null;
  if (configured && configuredHost && !(LOCAL.test(configuredHost) && host && !LOCAL.test(host))) return configured;
  if (!host) return configured ?? "http://localhost:3000";
  const proto = (input.forwardedProto ?? "").split(",")[0]!.trim() || (LOCAL.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}

/// Endereço público a partir de uma requisição de rota (redirecionamentos
/// de links de convite). `request.url` atrás do proxy do Railway é o
/// endereço interno (localhost); só vale como último recurso.
export function publicBaseUrlFromRequest(request: Request, configured: string | undefined = process.env.BETTER_AUTH_URL): string {
  return resolvePublicBaseUrl({
    configured,
    forwardedHost: request.headers.get("x-forwarded-host"),
    host: request.headers.get("host") ?? new URL(request.url).host,
    forwardedProto: request.headers.get("x-forwarded-proto"),
  });
}
