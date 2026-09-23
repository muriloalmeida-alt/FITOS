import "server-only";
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { R2Config } from "./r2Config";

/// Cliente R2 via API compatível com S3 (`@aws-sdk/client-s3`, dependência
/// mínima — nenhum SDK específico de storage). Nunca instanciado em código
/// que roda no browser: todos os usos vivem em módulos `server-only`
/// (este arquivo e `importExerciseImages.ts`, chamados só pelo script CLI
/// administrativo). `forcePathStyle: true` é a configuração recomendada
/// pela Cloudflare para R2 via SDK S3.
export function createR2Client(config: Pick<R2Config, "endpoint" | "region" | "accessKeyId" | "secretAccessKey">): S3Client {
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

/// Cache-control para asset imutável (chave determinística por slug+extensão
/// — uma imagem trocada usa uma chave nova, nunca reescreve o mesmo byte sob
/// o mesmo caminho com semântica diferente, então "immutable" é seguro sem
/// versionamento adicional).
export const EXERCISE_IMAGE_CACHE_CONTROL = "public, max-age=31536000, immutable";

export interface UploadAndVerifyInput {
  client: S3Client;
  bucket: string;
  key: string;
  body: Buffer;
  contentType: string;
}

/// Envia o objeto (`PutObjectCommand`) e só considera a operação concluída
/// depois de confirmar com `HeadObjectCommand` que o objeto existe e tem o
/// `ContentLength` esperado — "cada upload é confirmado antes da atualização
/// do banco" (critério de aceite). Lança em qualquer falha (upload ou
/// confirmação); quem chama nunca atualiza o banco quando esta função lança.
export async function uploadAndVerifyObject(input: UploadAndVerifyInput): Promise<void> {
  const { client, bucket, key, body, contentType } = input;

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: EXERCISE_IMAGE_CACHE_CONTROL,
    })
  );

  const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  if (head.ContentLength !== body.byteLength) {
    throw new Error(
      `Confirmação do objeto "${key}" falhou: tamanho gravado (${String(head.ContentLength)}) difere do esperado (${body.byteLength}).`
    );
  }
}

/// Content-Type real a partir da extensão do arquivo efetivamente lido
/// (nunca assumido/fixo) — as duas únicas extensões que este catálogo
/// aceita (seção 5 do escopo: WebP como padrão, PNG só se o pacote aprovado
/// ainda estiver nesse formato).
export function detectContentType(extension: string): string {
  switch (extension) {
    case "webp":
      return "image/webp";
    case "png":
      return "image/png";
    default:
      throw new Error(`Extensão de imagem não suportada: "${extension}". Use webp ou png.`);
  }
}
