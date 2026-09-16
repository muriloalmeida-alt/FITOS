import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/// Redirecionamento otimista baseado na presença do cookie de sessão (o
/// proxy roda em runtime Edge, sem acesso ao Prisma — "proxy" é o nome
/// atual do que era chamado de "middleware" no Next.js 16). Isso NÃO é a
/// autorização final — é apenas UX (evita mostrar `/entrar` a quem já tem
/// cookie, e afasta de `/painel` quem claramente não tem nenhum). A
/// validação real da sessão ocorre no servidor, dentro da própria página
/// (`getServerSession`, `src/modules/identity/session.ts`) — esconder uma
/// rota aqui não substitui essa checagem.
const PROTECTED_PREFIXES = ["/painel"];
const AUTH_ONLY_ROUTES = ["/entrar", "/criar-conta"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = Boolean(getSessionCookie(request));

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (isProtected && !hasSessionCookie) {
    const url = new URL("/entrar", request.url);
    url.searchParams.set("redirecionar", pathname);
    return NextResponse.redirect(url);
  }

  if (AUTH_ONLY_ROUTES.includes(pathname) && hasSessionCookie) {
    return NextResponse.redirect(new URL("/painel", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/painel/:path*", "/entrar", "/criar-conta"],
};
