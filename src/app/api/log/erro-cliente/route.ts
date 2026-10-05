import { NextResponse } from "next/server";
import { logEvent } from "@/shared/lib/serverLog";

/// Erros de tela do navegador (error boundaries) vão para os logs do
/// Railway. Público e sem dados sensíveis: só mensagem, digest, stack e a
/// página. Corpo limitado para não virar vetor de abuso.
export async function POST(request: Request) {
  const raw = await request.text().catch(() => "");
  if (raw.length > 20_000) return new NextResponse(null, { status: 413 });
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const text = (key: string) => (typeof body[key] === "string" ? (body[key] as string) : undefined);
  logEvent("error", "client_error", {
    boundary: text("boundary"),
    page: text("page"),
    message: text("message"),
    digest: text("digest"),
    stack: text("stack"),
    userAgent: request.headers.get("user-agent") ?? undefined,
  });
  return new NextResponse(null, { status: 204 });
}
