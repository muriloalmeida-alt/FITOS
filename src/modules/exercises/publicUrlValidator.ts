import "server-only";
import type { UploadImage } from "./importExerciseImages";
import { buildPublicImageUrl, stripExercisePrefixForPublicUrl, type R2Config } from "./r2Config";

/// Validação do modo `--public-only` (FIT-111/IMP-EX-003): os 203 objetos já
/// estão publicados no bucket R2 (upload feito fora deste ambiente, fora do
/// alcance de credenciais S3) — este módulo nunca envia nem apaga nada,
/// apenas confirma por HTTP que o objeto responde publicamente antes de
/// `importExerciseImages` gravar `imageUrl`/`imageAlt`. Implementado como uma
/// segunda `UploadImage` injetável (mesmo ponto de extensão que já protege o
/// banco: só é chamada fora de `dryRun`, e só grava depois de resolver sem
/// lançar) — nenhuma mudança em `importExerciseImages` foi necessária.
///
/// Nunca importa `./r2Client` nem `@aws-sdk/client-s3` — impossibilidade
/// estrutural (não só comportamental) de qualquer operação S3 autenticada
/// neste arquivo.

export class PublicImageUrlError extends Error {}

export interface ValidatePublicImageUrlOptions {
  /// Implementação de `fetch` injetável — produção usa o `fetch` global do
  /// Node; testes injetam um stub, nunca rede real.
  fetchImpl?: typeof fetch;
  /// Timeout por requisição (`AbortController`), aplicado a cada tentativa
  /// individualmente — uma tentativa lenta nunca trava o lote inteiro.
  timeoutMs?: number;
  /// Total de tentativas (1 + retentativas) para erros retentáveis (429,
  /// 5xx, timeout/erro de rede). 404/403/outros 4xx nunca retentam — são
  /// falhas terminais, reportadas na primeira tentativa.
  maxAttempts?: number;
  /// Atraso entre tentativas — testes usam 0 para não deixar a suíte lenta.
  retryDelayMs?: number;
}

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 300;

function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestWithTimeout(
  url: string,
  method: "HEAD" | "GET",
  fetchImpl: typeof fetch,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, {
      method,
      redirect: "follow",
      signal: controller.signal,
      // GET com o mínimo de transferência possível — um provedor que honra
      // Range responde 206 (dentro de 2xx); um que ignora responde 200 com o
      // corpo inteiro, que nunca é lido (ver `.cancel()` abaixo).
      headers: method === "GET" ? { Range: "bytes=0-0" } : undefined,
    });
  } finally {
    clearTimeout(timeout);
  }
}

/// Confirma, só por HTTP, que `url` responde publicamente antes de
/// `importExerciseImages` gravar o banco. Prefere `HEAD` (sem corpo); cai
/// para `GET` (Range mínimo, corpo nunca lido) só quando o provedor recusa
/// HEAD com 405/501 — alguns provedores de objeto público não implementam
/// HEAD. Aceita qualquer 2xx (200 ou 206). Nunca loga a URL como se fosse
/// segredo (é pública por definição), mas também nunca loga cabeçalho,
/// token ou valor de variável de ambiente.
export async function validatePublicImageUrl(url: string, options: ValidatePublicImageUrlOptions = {}): Promise<void> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;

  let lastFailureReason = "motivo desconhecido";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let response: Response;
    try {
      response = await requestWithTimeout(url, "HEAD", fetchImpl, timeoutMs);
      if (response.status === 405 || response.status === 501) {
        response = await requestWithTimeout(url, "GET", fetchImpl, timeoutMs);
      }
    } catch (error) {
      lastFailureReason = `erro de rede/timeout (${error instanceof Error ? error.message : String(error)})`;
      if (attempt < maxAttempts) {
        await sleep(retryDelayMs);
        continue;
      }
      throw new PublicImageUrlError(
        `Falha ao validar URL pública após ${String(attempt)} tentativa(s): ${lastFailureReason}. URL: ${url}`
      );
    }

    // Corpo do GET (quando houver) nunca é consumido — só o status importa.
    await response.body?.cancel().catch(() => undefined);

    if (response.ok) {
      return;
    }

    if (isRetryableStatus(response.status) && attempt < maxAttempts) {
      lastFailureReason = `HTTP ${String(response.status)}`;
      await sleep(retryDelayMs);
      continue;
    }

    throw new PublicImageUrlError(`URL pública respondeu HTTP ${String(response.status)} (esperado 2xx). URL: ${url}`);
  }

  throw new PublicImageUrlError(`Falha ao validar URL pública após ${String(maxAttempts)} tentativa(s): ${lastFailureReason}. URL: ${url}`);
}

/// `UploadImage` para o modo `--public-only`: em vez de enviar o objeto,
/// recalcula a mesma URL pública que `importExerciseImages` já usou para
/// `buildImageUrl` (pura, sem custo) e a valida por HTTP. A chave interna
/// (`exercises/<slug>.<ext>`) tem o prefixo `exercises/` removido antes de
/// montar a URL — o bucket real publica os objetos na raiz, sem esse
/// prefixo (`stripExercisePrefixForPublicUrl`). Lança exatamente como
/// `uploadAndVerifyObject` (S3) lançaria numa falha — o chamador
/// (`importExerciseImages`) já trata isso como falha isolada do item, nunca
/// atualizando o banco para aquele item, sem abortar o restante do lote.
export function createPublicOnlyUploadImage(
  config: Pick<R2Config, "publicBaseUrl">,
  options: ValidatePublicImageUrlOptions = {}
): UploadImage {
  return async ({ key }) => {
    const url = buildPublicImageUrl(config, stripExercisePrefixForPublicUrl(key));
    await validatePublicImageUrl(url, options);
  };
}
