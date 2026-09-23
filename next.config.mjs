/// remotePatterns restrito ao host de R2_PUBLIC_BASE_URL (migração de
/// storage das ilustrações de exercício para Cloudflare R2 — ver
/// docs/06-engenharia/arquitetura/ARMAZENAMENTO-DE-MIDIA-EXERCICIOS.md).
/// Só adiciona o padrão quando a variável está definida: em ambientes sem
/// R2 configurado (ex.: dev local sem essas credenciais), `next/image`
/// continua funcionando normalmente para os caminhos locais existentes em
/// `/media/exercises/...` — aqueles nunca passam por `remotePatterns`
/// (só se aplica a hosts externos). Nenhum curinga amplo: o hostname exato
/// da URL pública configurada, protocolo obrigatoriamente https.
function buildExerciseImageRemotePatterns() {
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL;
  if (!publicBaseUrl) {
    return [];
  }
  try {
    const url = new URL(publicBaseUrl);
    return [{ protocol: "https", hostname: url.hostname }];
  } catch {
    // R2_PUBLIC_BASE_URL malformada: falha silenciosamente aqui (não é
    // papel do next.config travar o build por isso) — a leitura real da
    // configuração, com erro claro, acontece em `r2Config.ts` no momento
    // em que o script de importação de fato precisa dela.
    return [];
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: buildExerciseImageRemotePatterns(),
  },
};

export default nextConfig;
