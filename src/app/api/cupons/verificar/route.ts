import { featureEnabled } from "@/shared/config/features";
import { checkSignupCoupon } from "@/modules/billing/signupCoupon";

/// Confere um cupom no cadastro, antes de a conta existir (público). Só
/// diz se o código vale para contas novas do produto e o resumo do
/// desconto; nunca revela listas ou regras internas.
export async function POST(request: Request) {
  if (!featureEnabled("CUPONS")) return Response.json({ error: "DESLIGADO", message: "Cupons indisponíveis no momento." }, { status: 404 });
  const body = (await request.json().catch(() => null)) as { code?: unknown; product?: unknown } | null;
  const product = body?.product === "PERSONAL" ? "PERSONAL" : "INDIVIDUAL";
  const result = await checkSignupCoupon(body?.code, product);
  if (!result.ok) return Response.json({ error: "CUPOM", message: result.message }, { status: 400 });
  return Response.json({ code: result.code, summary: result.summary });
}
