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
