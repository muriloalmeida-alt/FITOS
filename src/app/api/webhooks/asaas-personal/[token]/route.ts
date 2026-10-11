import { handlePersonalWebhook } from "@/modules/student-finance/paymentAccount";

/// Aviso de pagamento da conta Asaas de um personal (EPIC-38): dá a baixa
/// na mensalidade. O token da URL identifica a conta e o cabeçalho
/// `asaas-access-token` precisa bater com o segredo cadastrado.
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const body = await request.json().catch(() => null);
  const { status, result } = await handlePersonalWebhook({ token: (await params).token, headerToken: request.headers.get("asaas-access-token"), body });
  return Response.json({ result }, { status });
}
