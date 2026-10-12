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
