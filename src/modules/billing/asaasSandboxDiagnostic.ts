import "server-only";

const ASAAS_SANDBOX_CUSTOMERS_URL = "https://api-sandbox.asaas.com/v3/customers?limit=1";
const REQUEST_TIMEOUT_MS = 15_000;
const LOG_PREFIX = "[FIT-128][diagnostico-asaas]";

export interface AsaasSandboxDiagnosticDeps {
  appEnv: string;
  apiKey: string | undefined;
  fetchImpl: typeof fetch;
}

function isListShape(body: unknown): boolean {
  return (
    typeof body === "object" &&
    body !== null &&
    (body as Record<string, unknown>).object === "list" &&
    Array.isArray((body as Record<string, unknown>).data)
  );
}

/// Extrai só `code`/`description` do primeiro erro do payload de erro do
/// Asaas (`{"errors":[{"code":"...","description":"..."}]}`) — nunca o
/// restante do corpo. `description` é truncada defensivamente (nunca
/// esperamos algo longo aqui, mas nunca confiamos ciegamente no tamanho de
/// um payload de terceiro antes de logar).
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
/// — nunca a mensagem/stack completa, que poderia (em teoria) ecoar
/// detalhes da requisição.
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

/// Diagnóstico temporário da FIT-128 (Issue #153, EPIC-16) — nunca uma
/// integração real com o Asaas. Confirma, uma única vez por inicialização
/// do servidor (chamado por `register()` em `src/instrumentation.ts`,
/// nunca de uma rota HTTP — não existe endpoint público para isto), se o
/// runtime de homologação (diferente deste ambiente de desenvolvimento,
/// cujo próprio egresso de rede está bloqueado — ADR-003) consegue
/// autenticar uma leitura no Asaas Sandbox.
///
/// **Nunca loga**: a chave (`apiKey`), qualquer header, o corpo completo
/// da resposta, nem dado de cliente. Só status HTTP, duração e (em
/// sucesso) se o formato é de listagem; em erro, só código/descrição
/// saneados do próprio Asaas ou uma categoria de falha de rede.
///
/// **Remoção prevista**: depois que o resultado deste diagnóstico for
/// confirmado (ver `docs/06-engenharia/RUNBOOK-DIAGNOSTICO-ASAAS-HOMOLOGACAO.md`
/// e o diário de execução), este módulo e a chamada em
/// `src/instrumentation.ts` devem ser removidos — não é o adaptador real,
/// que só é escrito depois de confirmar conectividade/autenticação.
export async function runAsaasSandboxDiagnostic(deps: AsaasSandboxDiagnosticDeps): Promise<void> {
  if (deps.appEnv !== "homologacao") {
    return;
  }
  if (!deps.apiKey) {
    console.log(`${LOG_PREFIX} pulado: variável API_ASAAS não configurada neste ambiente.`);
    return;
  }

  const startedAt = Date.now();
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await deps.fetchImpl(ASAAS_SANDBOX_CUSTOMERS_URL, {
      method: "GET",
      headers: {
        access_token: deps.apiKey,
        "User-Agent": "FitOS/1.0",
      },
      signal: controller.signal,
    });
    const durationMs = Date.now() - startedAt;
    const body: unknown = await response.json().catch(() => null);

    if (response.ok) {
      console.log(
        `${LOG_PREFIX} sucesso: status=${response.status} duracaoMs=${durationMs} formatoDeListagem=${isListShape(body)}`
      );
      return;
    }

    const { code, description } = sanitizeErrorBody(body);
    console.error(
      `${LOG_PREFIX} falha: status=${response.status} duracaoMs=${durationMs} codigo=${code ?? "desconhecido"} descricao=${description ?? "sem descrição"}`
    );
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    console.error(`${LOG_PREFIX} erro de rede: duracaoMs=${durationMs} categoria=${categorizeNetworkError(error)}`);
  } finally {
    clearTimeout(timeoutHandle);
  }
}
