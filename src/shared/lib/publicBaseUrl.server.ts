import "server-only";
import { headers } from "next/headers";
import { resolvePublicBaseUrl } from "./publicBaseUrl";

/// `resolvePublicBaseUrl` com os cabeçalhos da requisição atual.
export async function publicBaseUrl(): Promise<string> {
  const list = await headers();
  return resolvePublicBaseUrl({ configured: process.env.BETTER_AUTH_URL, forwardedHost: list.get("x-forwarded-host"), host: list.get("host"), forwardedProto: list.get("x-forwarded-proto") });
}
