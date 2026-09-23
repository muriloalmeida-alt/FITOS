# ADR-010 — Cloudflare R2 como storage das ilustrações do catálogo

Status: **Aceito, execução real em homologação pendente de acesso de rede/credencial**
Data: 23 de setembro de 2026

## Contexto

ADR-001 (Railway como plataforma) já registrava, na seção "Consequências", que "arquivos permanecem em serviço S3 compatível a definir" — uma decisão deliberadamente postergada. Até esta rodada, as 43 ilustrações de exercício importadas pela FIT-111 viviam em `public/media/exercises/`, servidas como caminho estático pelo Next.js, com o próprio comentário do model `Exercise.imageUrl` afirmando "nunca um bucket/URL assinada".

Essa decisão original tinha uma justificativa real (nenhum caminho interno exposto, sem storage externo a configurar), mas não escala: o catálogo curado tem 208 exercícios (só 43 com ilustração hoje), o Railway não oferece volume persistente para o serviço web (filesystem efêmero — relevante para qualquer capacidade futura de upload em runtime, mesmo que os 43 arquivos atuais, por estarem versionados no Git, não sofram esse problema especificamente), e a plataforma já reservava R2 como candidato ("S3 compatível a definir").

## Decisão

Resolver a pendência do ADR-001: usar **Cloudflare R2** (storage compatível com S3) como storage canônico das ilustrações do catálogo, acessado via `@aws-sdk/client-s3` (cliente S3 padrão, `forcePathStyle: true`, sem SDK proprietário da Cloudflare).

- Convenção de chave determinística: `exercises/<slug>.<extensão-real>` (nunca sufixo aleatório — uma reexecução do importador sobrescreve o mesmo objeto).
- `Exercise.imageUrl` passa a ser a URL pública HTTPS montada a partir de `R2_PUBLIC_BASE_URL` + chave do objeto — nunca uma URL assinada (o bucket é servido publicamente, sem autenticação, mesmo modelo de exposição que o caminho estático anterior já tinha).
- Upload é sempre server-side, disparado manualmente por `scripts/import-imagens-exercicios.ts` — nunca por build, seed, deploy, nem por qualquer rota pública (não existe endpoint de upload).
- Cada objeto só é considerado gravado depois de confirmado por `HeadObjectCommand` (tamanho conferido) — o banco só é atualizado depois dessa confirmação.
- `public/media/exercises/*.webp` (as 43 imagens atuais) **permanece no repositório**, sem exclusão: continua sendo a fonte local que o importador lê antes de enviar ao R2, e é a fonte do teaser da landing (`src/app/page.tsx`), que não foi migrado nesta rodada (ver "Pendências" abaixo).

## Alternativas

- Manter caminho estático local (`public/`) — rejeitada: não resolve a pendência já registrada no ADR-001, e não permite atualizar/adicionar imagens sem um deploy de código.
- Volume persistente no Railway — rejeitada explicitamente pelo escopo desta migração ("Não use volume Railway"): não resolve o problema de fundo (imagens ainda vinculadas ao ciclo de vida do serviço web) e o plano atual do Railway não garante isso de forma simples.
- Banco de dados (Base64/BLOB) — rejeitada explicitamente: infla o banco, degrada performance de leitura, sem ganho de portabilidade real sobre um object storage dedicado.
- Outro provedor S3-compatível (AWS S3, Backblaze B2) — não avaliado nesta rodada; as variáveis `R2_*` já estavam provisionadas no serviço de homologação do Railway antes desta implementação, tornando R2 a escolha natural sem custo de decisão adicional.

## Consequências

- `src/modules/exercises/r2Config.ts` e `r2Client.ts` (novos, `server-only`) são o único ponto de leitura das variáveis `R2_*` e de instanciação do `S3Client` — nenhum outro módulo faz isso diretamente.
- `next.config.mjs` ganha `images.remotePatterns` restrito ao hostname de `R2_PUBLIC_BASE_URL`, condicional à variável estar definida — ambientes sem R2 configurado continuam servindo os caminhos locais legados sem nenhuma mudança de comportamento.
- O comentário do model `Exercise.imageUrl` (Prisma) e a arquitetura da FIT-111 (`BIBLIOTECA-ILUSTRADA-EXERCICIOS.md`) foram corrigidos nesta rodada para não afirmarem mais "nunca um bucket" — ver `ARMAZENAMENTO-DE-MIDIA-EXERCICIOS.md` para o comportamento operacional completo.
- **Execução real (upload de fato para o bucket R2 de homologação) não foi realizada nesta rodada** — o ambiente de execução deste agente não tem rota de rede liberada para o endpoint R2 (mesma política de proxy de egresso que já bloqueia `railway.com`, testada e confirmada nesta rodada) nem as credenciais reais (o Product Owner forneceu um token de acesso ao Railway, não credenciais R2, e esse token também não pôde ser testado pelo mesmo motivo de rede). A implementação foi validada de ponta a ponta com testes automatizados (mocks do cliente S3 e Postgres real de desenvolvimento) e com `--dry-run` local contra o Postgres de desenvolvimento — ver seção "Execução real" de `ARMAZENAMENTO-DE-MIDIA-EXERCICIOS.md`.
- **Cobertura de imagens continua em 43/208** — só existem 43 arquivos aprovados no repositório (mesmo total da FIT-111); os outros 165 exercícios do catálogo curado não têm ilustração aprovada disponível. Esta migração troca *onde* as 43 imagens existentes são servidas, não produz as 165 que faltam — isso depende de novos assets aprovados, fora do escopo desta ADR.
- O teaser da biblioteca na landing (`src/app/page.tsx`, seção `#biblioteca`) continua lendo o manifesto e montando o caminho local (`/media/exercises/<slug>.webp`) diretamente, sem consultar `Exercise.imageUrl` — não foi alterado nesta rodada por estar fora do escopo pedido (a landing não passa pelo catálogo `Exercise`, e os arquivos locais permanecem no repositório, então nenhuma imagem quebra). Migrá-lo para a mesma URL pública do R2 é uma pendência registrada, não um bug.
