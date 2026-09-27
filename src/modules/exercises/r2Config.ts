import "server-only";

/// Configuração do Cloudflare R2 usado como storage das ilustrações do
/// catálogo de exercícios (migração pós-FIT-111). Único ponto de leitura de
/// `process.env.R2_*` — nenhum outro módulo deve ler essas variáveis
/// diretamente, mesmo padrão já usado por `identity/auth.ts` para o Better
/// Auth. Mensagens de erro citam apenas o *nome* da variável ausente, nunca
/// seu valor — mesmo quando a variável está definida mas vazia.
export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  endpoint: string;
  publicBaseUrl: string;
  region: string;
}

export class R2ConfigError extends Error {}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new R2ConfigError(
      `Variável de ambiente obrigatória ausente: ${name}. Configure-a no serviço Railway (nunca em código ou .env versionado).`
    );
  }
  return value;
}

/// Remove barras finais para nunca produzir `//` ao concatenar com a chave
/// do objeto (regra explícita: "sem barra duplicada").
function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/u, "");
}

/// Lê e valida a configuração completa. Lança `R2ConfigError` citando só o
/// nome da primeira variável obrigatória ausente — nunca captura parcial
/// nem tenta seguir com config incompleta. `R2_REGION` é a única exceção:
/// tem fallback seguro para `"auto"` (valor recomendado pela Cloudflare para
/// R2), já que a maioria dos buckets R2 não usa região S3 real.
export function readR2Config(): R2Config {
  return {
    accountId: requiredEnv("R2_ACCOUNT_ID"),
    accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
    bucketName: requiredEnv("R2_BUCKET_NAME"),
    endpoint: stripTrailingSlash(requiredEnv("R2_ENDPOINT")),
    publicBaseUrl: stripTrailingSlash(requiredEnv("R2_PUBLIC_BASE_URL")),
    region: process.env.R2_REGION?.trim() || "auto",
  };
}

/// Nomes das variáveis obrigatórias (excluindo `R2_REGION`, que tem
/// fallback) — usado pelo `--dry-run` para reportar quais faltam, citando só
/// nomes, nunca valores, sem tentar instanciar o cliente R2.
export const REQUIRED_R2_ENV_VARS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_ENDPOINT",
  "R2_PUBLIC_BASE_URL",
] as const;

export function listMissingR2EnvVars(): string[] {
  return REQUIRED_R2_ENV_VARS.filter((name) => !process.env[name]);
}

const EXERCISE_OBJECT_PREFIX = "exercises";

/// Chave determinística do objeto no bucket — mesma extensão real do
/// arquivo lido (nunca fixa em `.webp`), nunca sufixo aleatório: uma
/// reexecução com o mesmo slug/extensão sempre aponta para o mesmo objeto.
export function buildExerciseObjectKey(slug: string, extension: string): string {
  return `${EXERCISE_OBJECT_PREFIX}/${slug}.${extension}`;
}

/// URL pública final a partir de `R2_PUBLIC_BASE_URL` + chave do objeto,
/// sem barra duplicada (a base já teve a barra final removida por
/// `readR2Config`).
export function buildPublicImageUrl(config: Pick<R2Config, "publicBaseUrl">, objectKey: string): string {
  return `${config.publicBaseUrl}/${objectKey}`;
}
