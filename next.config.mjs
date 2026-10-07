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
  // Versão gravada no build (commit do Railway): o app compara com a do
  // servidor em "Atualizar versão".
  env: {
    NEXT_PUBLIC_APP_VERSION: (process.env.RAILWAY_GIT_COMMIT_SHA ?? "dev").slice(0, 7),
  },
  images: {
    remotePatterns: buildExerciseImageRemotePatterns(),
  },
  // EPIC-31: o service worker das notificações nunca fica em cache (cada
  // deploy chega na hora) e é sempre servido como JavaScript.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
  // FIT-125/EPIC-16: `/criar-conta` foi renomeada para `/comecar` — redirect
  // permanente para não quebrar links já compartilhados/indexados (a query
  // string, ex.: `?modo=personal`, é preservada automaticamente pelo Next.js
  // quando o destino não declara os mesmos parâmetros).
  async redirects() {
    return [{ source: "/criar-conta", destination: "/comecar", permanent: true }];
  },
};

export default nextConfig;
