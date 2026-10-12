import { NextResponse } from "next/server";
import { openInvite } from "@/modules/crm/prospects";
import { CRM_INVITE_COOKIE, CRM_INVITE_MAX_AGE } from "@/shared/lib/crmCookie";

/// Link do convite do CRM ("Conheça o FitOS"): registra a abertura, guarda
/// o convite num cookie e leva ao cadastro do FitOS Livre. Link desconhecido,
/// descartado ou já usado leva à apresentação, sem cupom.
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const invite = await openInvite((await params).token).catch(() => null);
  const base = new URL(request.url);
  if (!invite) return NextResponse.redirect(new URL("/conheca", base));
  const response = NextResponse.redirect(new URL("/comecar?caminho=livre&convite=1", base));
  response.cookies.set(CRM_INVITE_COOKIE, invite.token, { httpOnly: true, sameSite: "lax", secure: base.protocol === "https:", path: "/", maxAge: CRM_INVITE_MAX_AGE });
  return response;
}
