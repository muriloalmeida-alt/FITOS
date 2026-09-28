import "server-only";

/// Base URL do Sandbox do Asaas — a única alcançada e autenticada até agora
/// (diagnóstico temporário da FIT-128, removido depois de confirmar
/// `access_token`/`User-Agent`/base URL a partir de homologação: HTTP 200 em
/// 497ms, formato de listagem válido). `api.asaas.com` (produção) nunca é
/// usado por este módulo — ADR-003 continua `Proposto`, nenhuma cobrança
/// produtiva pode ser construída sobre o candidato antes da prova completa
/// (`ASSINATURA-SAAS.md`) e da atualização do ADR para `Aceito`.
export const ASAAS_SANDBOX_BASE_URL = "https://api-sandbox.asaas.com/v3";

const REQUEST_TIMEOUT_MS = 15_000;

export interface AsaasClientConfig {
  apiKey: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

/// Erro único deste cliente — nunca deixa a chave, headers ou corpo
/// completo da resposta escaparem em `message`. `kind: "resposta_de_erro"`
/// veio do próprio Asaas (`status`/`codigo` preenchidos, `message` é a
/// descrição já saneada); `kind: "erro_de_rede"` é DNS/TLS/conexão/timeout
/// antes de qualquer resposta HTTP (`message` é só a categoria).
export class AsaasApiError extends Error {
  constructor(
    public readonly kind: "resposta_de_erro" | "erro_de_rede",
    message: string,
    public readonly status?: number,
    public readonly codigo?: string
  ) {
    super(message);
    this.name = "AsaasApiError";
  }
}

export interface AsaasListResponse<T> {
  object: "list";
  hasMore: boolean;
  totalCount: number;
  limit: number;
  offset: number;
  data: T[];
}

/// Extrai só `code`/`description` do primeiro erro do payload de erro do
/// Asaas (`{"errors":[{"code":"...","description":"..."}]}`) — nunca o
/// restante do corpo. `description` é truncada defensivamente.
function sanitizeErrorBody(body: unknown): { code?: string; description?: string } {
  if (typeof body !== "object" || body === null) {
    return {};
  }
  const errors = (body as Record<string, unknown>).errors;
  if (!Array.isArray(errors) || errors.length === 0) {
    return {};
  }
  const first = errors[0];
  if (typeof first !== "object" || first === null) {
    return {};
  }
  const record = first as Record<string, unknown>;
  const code = typeof record.code === "string" ? record.code : undefined;
  const description = typeof record.description === "string" ? record.description.slice(0, 300) : undefined;
  return { code, description };
}

/// Categoriza uma falha de rede/TLS/DNS a partir só do código de erro do
/// Node (`error.cause.code`) ou do nome do erro (`AbortError` do timeout)
/// — nunca a mensagem/stack completa.
function categorizeNetworkError(error: unknown): string {
  if (error instanceof Error && error.name === "AbortError") {
    return "timeout";
  }
  const cause = error instanceof Error ? (error as Error & { cause?: { code?: unknown } }).cause : undefined;
  const code = cause && typeof cause.code === "string" ? cause.code : undefined;
  if (!code) {
    return "desconhecido";
  }
  if (code.startsWith("ENOTFOUND") || code === "EAI_AGAIN") {
    return `dns:${code}`;
  }
  if (code.startsWith("ECONN")) {
    return `conexao:${code}`;
  }
  if (code.includes("CERT") || code.includes("SSL") || code.includes("TLS")) {
    return `tls:${code}`;
  }
  return code;
}

/// Requisição autenticada de baixo nível ao Asaas — mecânica HTTP
/// empiricamente provada (header `access_token`, `User-Agent: FitOS/1.0`,
/// base URL do Sandbox, timeout de 15s). Nunca loga nada: lança
/// `AsaasApiError` já saneado para o chamador decidir o que fazer/logar.
///
/// **Só a leitura (`listAsaasCustomers`) foi exercida contra o Asaas real**
/// (via o diagnóstico agora removido). Qualquer método de escrita
/// construído sobre este cliente segue o contrato público documentado do
/// Asaas v3, mas ainda não foi exercido contra a API real — nunca tratar
/// como comportamento confirmado antes de uma prova técnica real.
export async function asaasRequest<T>(config: AsaasClientConfig, path: string, init?: RequestInit): Promise<T> {
  const fetchImpl = config.fetchImpl ?? fetch;
  const baseUrl = config.baseUrl ?? ASAAS_SANDBOX_BASE_URL;
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    let response: Response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        ...init,
        headers: {
          access_token: config.apiKey,
          "User-Agent": "FitOS/1.0",
          "Content-Type": "application/json",
          ...init?.headers,
        },
        signal: controller.signal,
      });
    } catch (error) {
      throw new AsaasApiError("erro_de_rede", categorizeNetworkError(error));
    }

    const body: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const { code, description } = sanitizeErrorBody(body);
      throw new AsaasApiError(
        "resposta_de_erro",
        description ?? "Erro retornado pelo Asaas sem descrição.",
        response.status,
        code
      );
    }

    return body as T;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

export interface AsaasCustomerSummary {
  id: string;
  name: string;
}

/// Única chamada empiricamente provada até agora (diagnóstico da FIT-128,
/// via Railway/homologação: HTTP 200, 497ms, formato de listagem válido).
export async function listAsaasCustomers(
  config: AsaasClientConfig,
  params: { limit?: number } = {}
): Promise<AsaasListResponse<AsaasCustomerSummary>> {
  const limit = params.limit ?? 1;
  return asaasRequest<AsaasListResponse<AsaasCustomerSummary>>(config, `/customers?limit=${String(limit)}`, {
    method: "GET",
  });
}

/// Métodos de escrita abaixo (`createAsaasCustomer` em diante) seguem o
/// contrato público documentado do Asaas v3 — nunca exercidos contra a
/// API real ainda (só a leitura acima foi). `src/modules/billing/
/// subscriptions.ts` só os usa em modo "melhor esforço" (nunca bloqueia o
/// usuário se algo aqui falhar) até que o resultado real seja confirmado
/// em homologação, mesmo padrão de cautela do diagnóstico original.

export interface AsaasCustomerInput {
  name: string;
  cpfCnpj: string;
  externalReference?: string;
}

export interface AsaasCustomer {
  id: string;
  name: string;
  cpfCnpj: string;
}

/// Busca um cliente já existente pelo CPF/CNPJ — usada antes de criar um
/// novo, para nunca duplicar o cadastro no Asaas se uma tentativa anterior
/// já tiver criado o cliente mas falhado antes de salvar o
/// `externalCustomerId` localmente.
export async function findAsaasCustomerByCpfCnpj(config: AsaasClientConfig, cpfCnpj: string): Promise<AsaasCustomer | null> {
  const result = await asaasRequest<AsaasListResponse<AsaasCustomer>>(
    config,
    `/customers?cpfCnpj=${encodeURIComponent(cpfCnpj)}`,
    { method: "GET" }
  );
  return result.data[0] ?? null;
}

export async function createAsaasCustomer(config: AsaasClientConfig, input: AsaasCustomerInput): Promise<AsaasCustomer> {
  return asaasRequest<AsaasCustomer>(config, "/customers", { method: "POST", body: JSON.stringify(input) });
}

/// `UNDEFINED` deixa o próprio pagador escolher o meio de pagamento
/// (Pix/cartão/carteira digital, conforme habilitado na conta) a cada
/// cobrança — decisão de Murilo (FIT-128): a assinatura SaaS do FitOS
/// aceita Pix, cartão de crédito e carteiras digitais, nunca só um único
/// meio fixo por assinatura.
export type AsaasBillingType = "UNDEFINED" | "BOLETO" | "CREDIT_CARD" | "PIX";
export type AsaasBillingCycle = "MONTHLY" | "YEARLY";

export interface AsaasSubscriptionInput {
  customer: string;
  billingType: AsaasBillingType;
  value: number;
  nextDueDate: string;
  cycle: AsaasBillingCycle;
  description?: string;
  externalReference?: string;
}

export interface AsaasSubscription {
  id: string;
  customer: string;
  status: string;
}

export async function createAsaasSubscription(config: AsaasClientConfig, input: AsaasSubscriptionInput): Promise<AsaasSubscription> {
  return asaasRequest<AsaasSubscription>(config, "/subscriptions", { method: "POST", body: JSON.stringify(input) });
}

export interface UpdateAsaasSubscriptionInput {
  billingType?: AsaasBillingType;
  value?: number;
  cycle?: AsaasBillingCycle;
  description?: string;
  /// Presente só quando o checkout embutido (FIT-128) tokenizou um cartão
  /// para esta assinatura — `updateAsaasSubscription` então também manda
  /// `billingType: "CREDIT_CARD"` (nunca `UNDEFINED` depois que existe um
  /// cartão cadastrado): a partir daí, o Asaas cobra automaticamente esse
  /// cartão a cada vencimento, sem nenhuma ação adicional do cliente —
  /// exatamente o "cliente completa 100% do checkout uma vez" decidido
  /// por Murilo.
  creditCardToken?: string;
}

/// Nunca inclui `nextDueDate`: mudar a data da próxima cobrança de uma
/// assinatura real já em curso poderia disparar uma cobrança fora de
/// hora — uma troca de plano só atualiza valor/ciclo/descrição, nunca
/// quando a próxima cobrança acontece.
export async function updateAsaasSubscription(
  config: AsaasClientConfig,
  subscriptionId: string,
  input: UpdateAsaasSubscriptionInput
): Promise<AsaasSubscription> {
  return asaasRequest<AsaasSubscription>(config, `/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function cancelAsaasSubscription(config: AsaasClientConfig, subscriptionId: string): Promise<void> {
  await asaasRequest(config, `/subscriptions/${encodeURIComponent(subscriptionId)}`, { method: "DELETE" });
}

/// Tokenização de cartão de crédito (FIT-128, checkout embutido no
/// FitOS — decisão de Murilo: "toda a transação deve ocorrer no FitOS, o
/// Asaas deve ser o gateway"). O número completo do cartão e o CVV
/// passam por este cliente só em trânsito, nunca persistidos em disco
/// nem logados em nenhum lugar (`checkout.ts` só grava o retorno já
/// mascarado). Segue o contrato público documentado do Asaas v3
/// (`POST /v3/creditCard/tokenize`) — ainda não exercido contra a API
/// real, mesma cautela de sempre com métodos de escrita novos.
export interface AsaasCreditCardInput {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
}

export interface AsaasCreditCardHolderInfo {
  name: string;
  email: string;
  cpfCnpj: string;
  postalCode: string;
  addressNumber: string;
  phone: string;
}

export interface AsaasTokenizeCreditCardInput {
  customer: string;
  creditCard: AsaasCreditCardInput;
  creditCardHolderInfo: AsaasCreditCardHolderInfo;
}

/// Resposta já mascarada pelo próprio Asaas — `creditCardNumber` aqui é
/// só os últimos 4 dígitos (nome do campo é do Asaas, não deste código;
/// nunca o número completo). `creditCardToken` é o único valor reusável
/// para cobrar este cartão depois, nunca persistido localmente (o Asaas
/// já o associa à assinatura via `updateAsaasSubscription`).
export interface AsaasTokenizedCreditCard {
  creditCardNumber: string;
  creditCardBrand: string;
  creditCardToken: string;
}

export async function tokenizeAsaasCreditCard(
  config: AsaasClientConfig,
  input: AsaasTokenizeCreditCardInput
): Promise<AsaasTokenizedCreditCard> {
  return asaasRequest<AsaasTokenizedCreditCard>(config, "/creditCard/tokenize", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
