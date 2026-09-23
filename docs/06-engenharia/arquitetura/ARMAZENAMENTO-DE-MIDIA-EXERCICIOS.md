# Armazenamento de mídia — ilustrações do catálogo de exercícios (R2)

Ver ADR-010 para a decisão e o contexto. Este documento é operacional: como configurar, rodar, verificar e reverter.

## Visão geral

`Exercise.imageUrl`/`imageAlt` (FIT-111) são preenchidos por `scripts/import-imagens-exercicios.ts`, que:

1. lê o asset local aprovado em `public/media/exercises/<slug>.webp` (ou `.png`, se essa for a extensão real do arquivo aprovado);
2. envia o arquivo ao bucket Cloudflare R2, numa chave determinística (`exercises/<slug>.<extensão>`);
3. confirma que o objeto foi gravado corretamente (`HeadObjectCommand`, tamanho conferido);
4. só então atualiza `Exercise.imageUrl` (URL pública HTTPS a partir de `R2_PUBLIC_BASE_URL`) e `Exercise.imageAlt`.

Nunca cria um `Exercise` novo — localiza o registro `FITOS_CURATED` já existente por `canonicalKey` (o mesmo `externalId` que a IMP-EX-002 já usa). Nunca é chamado por build, seed ou deploy — execução manual, deliberadamente.

**O filesystem do serviço web no Railway é efêmero** (sem volume persistente) — por isso o R2 é o storage canônico, não um cache de conveniência: qualquer imagem que só existisse localmente na instância em runtime seria perdida no próximo deploy. Os 43 arquivos atuais não sofrem esse risco por estarem versionados no Git (redeploy sempre os traz de volta) — mas uma futura funcionalidade de upload em runtime (ex.: personal enviando sua própria ilustração) sofreria, e é exatamente esse cenário que o R2 já resolve de antemão.

## Variáveis de ambiente

Todas em `.env.example` (nomes e exemplos fictícios, nunca valores reais). Lidas exclusivamente por `src/modules/exercises/r2Config.ts` (`server-only`):

| Variável | Obrigatória | Descrição |
|---|---|---|
| `R2_ACCOUNT_ID` | Sim | ID da conta Cloudflare. |
| `R2_ACCESS_KEY_ID` | Sim | Access key de uma API Token do R2 (nunca a chave-mestra da conta). |
| `R2_SECRET_ACCESS_KEY` | Sim | Secret key correspondente. |
| `R2_BUCKET_NAME` | Sim | Bucket dedicado às ilustrações do catálogo. |
| `R2_ENDPOINT` | Sim | Endpoint S3-compatível da conta (`https://<account-id>.r2.cloudflarestorage.com`). |
| `R2_PUBLIC_BASE_URL` | Sim | Domínio público usado para montar a URL final de cada imagem. |
| `R2_REGION` | Não (fallback `"auto"`) | Região S3 informada ao SDK. |

Uma variável obrigatória ausente nunca é reportada com seu valor — só o nome, tanto pelo módulo de configuração (`R2ConfigError`) quanto pelo `--dry-run` do script (`listMissingR2EnvVars`).

## Convenção dos object keys e política de cache

- Chave: `exercises/<slug>.<extensão-real-do-arquivo>` (`buildExerciseObjectKey`). Determinística — o mesmo slug/extensão sempre produz a mesma chave, então uma reexecução **sobrescreve o mesmo objeto**, nunca cria uma cópia com sufixo.
- Extensão nunca é assumida fixa: o leitor de asset local (`createPublicDirImageReader`) procura `.webp` primeiro, depois `.png`, e usa a extensão real encontrada tanto na chave do objeto quanto no `Content-Type` enviado (`image/webp` ou `image/png`).
- `Cache-Control: public, max-age=31536000, immutable` em todo objeto enviado (`EXERCISE_IMAGE_CACHE_CONTROL`) — seguro porque a chave é determinística por conteúdo esperado (slug+extensão); se uma imagem precisar ser **substituída** sob o mesmo slug no futuro, a chave deve mudar (ex.: sufixo de versão) ou o cache deixa de ser seguro como "immutable" — não implementado nesta rodada por não haver caso de uso ainda.

## Comandos

```bash
# Simula sem enviar nada ao R2 e sem gravar no banco — funciona mesmo sem
# nenhuma variável R2 configurada (só avisa quais estão ausentes).
npm run catalog:import-imagens-exercicios -- --dry-run

# Carga real — envia ao R2, confirma cada objeto, só então grava o banco.
# Exige as 6 variáveis R2 obrigatórias configuradas; sem elas, aborta antes
# de qualquer upload.
npm run catalog:import-imagens-exercicios

# Reverte só os vínculos de banco (imageUrl/imageAlt = null) dos exercícios
# referenciados pelo manifesto atual. Nunca apaga objetos do bucket.
npm run catalog:import-imagens-exercicios -- --revert
```

### Saída do `--dry-run`

Reporta, sem tocar rede nem banco além de leitura: `encontrados` (total do manifesto), `já_vinculados` (`imageUrl`/`imageAlt` já batem com o alvo), `novos` (seriam importados pela primeira vez), `atualizáveis` (exercício já tinha outra imagem/alt), `ausentes` (arquivo local não encontrado para o slug), `outros_falhos` (ex.: `canonicalKey` sem `Exercise` correspondente). Cada item `falho` é listado individualmente com o motivo.

### Idempotência e integridade

- Reexecutar sem nenhuma mudança no manifesto/URL alvo: tudo `ignorado`, nenhuma chamada de upload, nenhuma escrita no banco.
- Falha de upload (`PutObjectCommand`) ou de confirmação (`HeadObjectCommand` com tamanho divergente): item marcado `falho`, banco **não** é atualizado para aquele item — os demais itens do lote continuam sendo processados normalmente (falha isolada por item, `try/catch` individual).
- `canonicalKey` sem `Exercise` correspondente: `falho`, nunca cria exercício novo.
- Um `Exercise` de outra origem (`PERSONAL`) com a mesma string de `externalId` nunca é afetado — a busca sempre filtra `origin: "FITOS_CURATED"` explicitamente.
- `validateExerciseImageManifest` roda antes de qualquer processamento e bloqueia o comando inteiro (exit code 1) se houver `canonicalKey`/`slug` duplicado ou campo obrigatório vazio no manifesto — nunca processa um manifesto estruturalmente inválido.

## Compatibilidade da aplicação

- `next.config.mjs`: `images.remotePatterns` inclui o hostname de `R2_PUBLIC_BASE_URL` quando essa variável está definida — permite `next/image` renderizar URLs absolutas do R2. Sem a variável (ex.: dev local sem R2 configurado), nenhum padrão é adicionado e os caminhos locais legados (`/media/exercises/...`, que não passam por `remotePatterns`) continuam funcionando sem nenhuma mudança.
- `ExerciseThumbnail` (`src/shared/ui/`) não precisou de nenhuma mudança — já era agnóstico ao formato/origem de `src` (URL relativa ou absoluta), com fallback visual ("Sem imagem") preservado tanto para `imageUrl` nulo quanto para falha real de carregamento (`onError`).
- `imageAlt` continua sendo texto funcional do movimento em português, nunca alterado por esta migração.

## Procedimento de homologação e promoção

1. Confirmar que o deploy do serviço `fitos-web-hml` está `SUCCESS` no commit desta migração.
2. Rodar `--dry-run` **no ambiente de homologação** (via Railway CLI/SSH, ou por quem tiver esse acesso — este agente não tem, ver "Execução real" abaixo) e registrar a saída sanitizada (sem segredos — a saída do comando nunca inclui valores de variável, só nomes e contadores).
3. Só se o dry-run apontar zero bloqueios (nenhum manifesto inválido, nenhuma variável R2 ausente) e a contagem de `ausentes` for a esperada (hoje, 0 dos 43 atuais — os outros 165 exercícios do catálogo simplesmente não estão no manifesto, não aparecem como "ausentes"), rodar a carga real.
4. Validar no R2: contagem de objetos sob o prefixo `exercises/` corresponde ao número de itens `importados`/`atualizados` reportados.
5. Validar no PostgreSQL de homologação: `Exercise` com `origin = 'FITOS_CURATED'` e `imageUrl` preenchido tem contagem igual à soma de `já_vinculados` + `importados` + `atualizados`; nenhum `Exercise` com `origin = 'PERSONAL'` foi alterado.
6. Amostrar pelo menos 10 URLs (distribuídas entre grupos musculares) com uma requisição HTTP simples: `200`, `Content-Type` de imagem.
7. Abrir `/painel/exercicios` (lista e detalhe) em desktop e mobile: imagem carregando, `alt` correto, nenhum ícone de imagem quebrada.
8. Rodar o comando de carga real uma segunda vez: esperado 100% `ignorado`, zero `importado`/`atualizado` novo, zero objeto novo no bucket.

### Execução real — bloqueio registrado nesta rodada

Este agente **não executou** upload real nem validação em homologação. Dois motivos, ambos confirmados nesta sessão, não presumidos:

- **Rede**: o ambiente de execução deste agente bloqueia conexões de saída para o endpoint R2 pela mesma política de proxy de egresso que já bloqueia `railway.com` (testado e confirmado nesta rodada com uma tentativa real de conexão).
- **Credenciais**: as variáveis `R2_*` estão configuradas no serviço Railway de homologação, não neste ambiente local/sandbox; o token de acesso fornecido nesta sessão foi para o Railway (não para o R2) e também não pôde ser validado pelo mesmo bloqueio de rede.

O que foi comprovado nesta rodada, sem depender de rede real:
- Testes automatizados (mocks do `S3Client`, Postgres real de desenvolvimento) cobrindo upload bem-sucedido, falha de upload, falha de confirmação, idempotência, validação de manifesto, exercício inexistente/de origem errada, ausência de segredos no relatório.
- `--dry-run` real contra o Postgres de desenvolvimento: `43 encontrados`, `0 ausentes`, `43 atualizáveis` (os 43 já tinham `imageUrl` local da FIT-111 — a migração para R2 os trataria como atualização, não importação nova), variáveis R2 corretamente reportadas como ausentes neste ambiente.

**Quem tiver acesso de rede e as credenciais R2 reais de homologação** pode rodar exatamente os comandos da seção "Comandos" acima, sem nenhuma mudança de código — a implementação está completa e testada, só a execução contra o ambiente real está pendente.

## Rollback

- `npm run catalog:import-imagens-exercicios -- --revert`: limpa `imageUrl`/`imageAlt` de todo `Exercise` `FITOS_CURATED` referenciado pelo manifesto atual. Nunca apaga o `Exercise` em si.
- **Nunca apaga objetos do bucket R2** por padrão — um objeto órfão (sem nenhum `Exercise.imageUrl` apontando pra ele) não é servido a ninguém e não representa risco; exclusão de objeto exigiria uma flag explícita adicional, ainda não implementada (risco desproporcional ao benefício nesta fase).
- Para validar que o rollback terminou sem imagens quebradas: repetir o passo 7 do procedimento de homologação (abrir `/painel/exercicios`) — `ExerciseThumbnail` já trata `imageUrl` nulo com o placeholder "Sem imagem", nunca um ícone de imagem quebrada do navegador.

## Riscos e controles de segurança

- Upload é exclusivamente server-side (dentro do script CLI administrativo) — nenhuma rota HTTP pública expõe upload, nenhum código de cliente instancia o `S3Client`.
- Credenciais nunca aparecem em log, relatório, PR ou documentação — só nomes de variável, nunca valores, em qualquer mensagem de erro (`R2ConfigError`, mensagens de falha de upload).
- URL pública do R2 nunca é assinada (bucket servido publicamente, mesmo modelo de exposição que o caminho estático local já tinha) — não há segredo na própria URL da imagem.
- `next.config.mjs` restringe `remotePatterns` ao hostname exato de `R2_PUBLIC_BASE_URL`, nunca um curinga amplo.

## Pendências reais

- Cobertura de imagens continua em 43/208 — os outros 165 exercícios do catálogo curado não têm ilustração aprovada disponível no repositório; produzi-las é uma decisão de conteúdo/produto, fora do escopo desta migração de storage.
- O teaser da biblioteca na landing (`src/app/page.tsx`, seção `#biblioteca`) continua servindo os 43 arquivos locais diretamente (não consulta `Exercise.imageUrl`, não foi migrado para R2 nesta rodada) — ver ADR-010.
- Exclusão controlada de objetos órfãos no bucket (flag explícita + confirmação) não foi implementada — não havia caso de uso real para priorizar isso nesta rodada.
