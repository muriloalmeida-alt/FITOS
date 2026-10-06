import { REFERRAL_COOKIE, isReferralCode } from "@/modules/billing/referrals";

/// Link de indicação de um personal (EPIC-47): guarda o código por 60 dias
/// e leva para o cadastro de personal.
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!isReferralCode(code)) return Response.redirect(new URL("/comecar?caminho=personal", request.url), 302);
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  const headers = new Headers({ Location: new URL("/comecar?caminho=personal&indicado=1", request.url).toString() });
  headers.append("Set-Cookie", `${REFERRAL_COOKIE}=${code}; Path=/; Max-Age=${60 * 86_400}; HttpOnly; SameSite=Lax${secure}`);
  return new Response(null, { status: 302, headers });
}
