import { secretsMatch } from "@/shared/lib/secretCompare";
import { parseAsaasWebhookPayload, reconcileAsaasPaymentEvent } from "@/modules/billing/asaasWebhook";

const LOG_PREFIX = "[FIT-128][webhook-asaas]";

/// Header em que o Asaas devolve o token de autenticação configurado no
/// próprio painel do webhook (nunca a chave de API `API_ASAAS`, que é só
/// para requisições que o FitOS faz *ao* Asaas) — segue o nome de header
/// publicamente documentado do Asaas v3, ainda não confirmado contra uma
/// entrega real (ver `RUNBOOK-VERIFICACAO-WEBHOOK-ASAAS-HOMOLOGACAO.md`).
const ASAAS_WEBHOOK_TOKEN_HEADER = "asaas-access-token";

/// Recebe eventos de pagamento do Asaas (ADR-010, item (c)) e reconcilia o
/// estado local da assinatura (`SaasSubscription.status`). Nunca confia no
/// corpo sem validar primeiro o token de autenticação (comparação em tempo
/// constante, `secretsMatch`) — sem isso, qualquer request externo poderia
/// forjar "pagamento recebido"/"pagamento em atraso" para qualquer tenant.
///
/// Sempre responde 200 quando o token é válido e o payload é reconhecível,
/// mesmo que nenhuma assinatura local corresponda ao evento (pode ser
/// dado do Sandbox sem relação com o FitOS) — nunca fazer o Asaas reentregar
/// o mesmo evento indefinidamente por um caso que não é um erro nosso.
export async function POST(request: Request) {
  const expectedToken = process.env.API_ASAAS_WEBHOOK_TOKEN;
  if (!expectedToken) {
    console.error(`${LOG_PREFIX} recusado: API_ASAAS_WEBHOOK_TOKEN não configurado neste ambiente.`);
    return Response.json({ error: "NAO_CONFIGURADO" }, { status: 503 });
  }

  const providedToken = request.headers.get(ASAAS_WEBHOOK_TOKEN_HEADER) ?? "";
  if (!providedToken || !secretsMatch(providedToken, expectedToken)) {
    console.error(`${LOG_PREFIX} recusado: token de autenticação do webhook ausente ou inválido.`);
    return Response.json({ error: "NAO_AUTORIZADO" }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  const payload = parseAsaasWebhookPayload(body);
  if (!payload) {
    console.error(`${LOG_PREFIX} recusado: formato de payload inesperado.`);
    return Response.json({ error: "PAYLOAD_INVALIDO" }, { status: 400 });
  }

  const result = await reconcileAsaasPaymentEvent(payload);
  console.log(`${LOG_PREFIX} evento=${payload.event} pagamento=${payload.payment.id} resultado=${result.outcome}`);

  return Response.json({ status: "recebido" });
}
