# Armazenamento de mídia — ilustrações do catálogo de exercícios (R2)

Ver ADR-011 para a decisão e o contexto. Este documento é operacional: como configurar, rodar, verificar e reverter.

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

# Modo --public-only (ver seção dedicada abaixo) — vincula objetos já
# publicados no bucket, sem nenhuma operação S3 autenticada.
npm run catalog:import-imagens-exercicios -- --public-only --dry-run
npm run catalog:import-imagens-exercicios -- --public-only
```

## Modo `--public-only`

**Finalidade.** Os uploads S3 autenticados (`HeadObjectCommand`/`PutObjectCommand`) passaram a falhar com `Access Denied` neste ambiente, mesmo com os 203 objetos já publicados no bucket `fitos-exercicios` e acessíveis publicamente (ex.: `https://pub-76bc00d74c5a4bf98ccac51eb4c92de3.r2.dev/abdominal-bicicleta.webp`). Como o upload já aconteceu por outro canal (fora deste script/ambiente), o único trabalho real que falta é **vincular** o catálogo à URL pública — não repetir o upload. `--public-only` existe exatamente para esse cenário: reaproveita `importExerciseImages` (mesma trava de idempotência, mesmo "nunca cria exercício novo", mesmo `--dry-run`) trocando só a etapa de upload por uma validação HTTP da URL pública, via `createPublicOnlyUploadImage`/`validatePublicImageUrl` (`src/modules/exercises/publicUrlValidator.ts`).

**Quando usar.** Só quando os objetos já estiverem de fato no bucket (confirmado por fora, ex.: pelo Product Owner com acesso ao Cloudflare) e o caminho de credencial S3 estiver bloqueado/indisponível para esta execução — nunca como substituto padrão do modo S3 (que continua sendo o caminho correto quando as credenciais funcionam, porque só ele efetivamente envia um objeto novo ao bucket).

**Variáveis necessárias.** Só `R2_PUBLIC_BASE_URL` (`readPublicOnlyR2Config`) — nunca `R2_ACCOUNT_ID`/`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`R2_ENDPOINT`/`R2_BUCKET_NAME`. Ausente → o script aborta antes de qualquer escrita (dry-run ou real), citando só o nome da variável.

**Garantia de nunca enviar nem excluir objetos.** `publicUrlValidator.ts` não importa `./r2Client` nem `@aws-sdk/client-s3` — impossibilidade estrutural, não só comportamental, de `HeadObjectCommand`/`PutObjectCommand`/`S3Client` nesse caminho. A única operação de rede é uma requisição HTTP `HEAD` (ou `GET` com `Range: bytes=0-0` quando o provedor recusa `HEAD` com 405/501) contra a própria URL pública, seguindo redirecionamentos, com timeout por tentativa (`AbortController`) e retentativa curta só para `429`/5xx/erro de rede — nunca para `404`/`403`/outros 4xx, que falham na primeira tentativa. Só uma resposta `2xx` é aceita; qualquer outra marca o item como `falho` (nunca atualiza aquele `Exercise`) sem abortar o restante do lote.

**Comando de dry-run:**
```bash
npm run catalog:import-imagens-exercicios -- --public-only --dry-run
```
Nunca chama a rede de validação (o `--dry-run` de `importExerciseImages` retorna antes de chamar `uploadImage`, mesmo comportamento do modo S3) — só confirma manifesto, monta a URL alvo a partir de `R2_PUBLIC_BASE_URL` e reporta `novos`/`atualizáveis`/`já_vinculados` como sempre.

**Comando real:**
```bash
npm run catalog:import-imagens-exercicios -- --public-only
```

**Reversão (só de banco).** Igual ao modo S3 — `--revert` nunca depende do modo de storage usado na carga original:
```bash
npm run catalog:import-imagens-exercicios -- --revert
```
`--public-only` combinado com `--revert` é recusado explicitamente pelo script (exit code 1, nenhuma ação): `--revert` é uma operação só de banco, então a combinação seria ambígua sem agregar nenhum comportamento novo — rode `--revert` sozinho.

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
3. Só se o dry-run apontar zero bloqueios (nenhum manifesto inválido, nenhuma variável R2 ausente) e a contagem de `ausentes` for a esperada (hoje, 0 dos 203 do manifesto — os 5 exercícios sem imagem simplesmente não estão no manifesto ainda, não aparecem como "ausentes"), rodar a carga real.
4. Validar no R2: contagem de objetos sob o prefixo `exercises/` corresponde ao número de itens `importados`/`atualizados` reportados.
5. Validar no PostgreSQL de homologação: `Exercise` com `origin = 'FITOS_CURATED'` e `imageUrl` preenchido tem contagem igual à soma de `já_vinculados` + `importados` + `atualizados`; nenhum `Exercise` com `origin = 'PERSONAL'` foi alterado.
6. Amostrar pelo menos 10 URLs (distribuídas entre grupos musculares) com uma requisição HTTP simples: `200`, `Content-Type` de imagem.
7. Abrir `/painel/exercicios` (lista e detalhe) em desktop e mobile: imagem carregando, `alt` correto, nenhum ícone de imagem quebrada.
8. Rodar o comando de carga real uma segunda vez: esperado 100% `ignorado`, zero `importado`/`atualizado` novo, zero objeto novo no bucket.

### Execução real — histórico

Este agente não tem, neste ambiente de execução, rota de rede liberada para o endpoint R2 nem credenciais R2 reais (mesmo bloqueio de proxy de egresso já registrado para `railway.com`) — por isso a carga real nunca pôde ser executada nem verificada de forma independente a partir daqui, em nenhuma rodada.

- **27/09/2026** — Murilo (Product Owner, com acesso direto ao Railway/Cloudflare) confirmou que as imagens do lote atual já estavam publicadas no bucket R2.
- **Tentativa seguinte em homologação**: o modo S3 (upload autenticado) falhou com `Access Denied` em todas as 203 entradas (`encontrados=203 outros_falhos=203 importados=0 atualizados=0`) — as credenciais configuradas no serviço `fitos-web-hml` não têm (ou perderam) permissão para `HeadObjectCommand`/`PutObjectCommand`, mesmo os objetos já estando publicamente acessíveis pela própria URL R2.dev. Como nenhum item chegou a ser gravado (todos falharam antes de qualquer `client.exercise.update`), não havia carga parcial para reparar.
- **Correção (28/09/2026, FIT-111/IMP-EX-003)**: adicionado o modo `--public-only` (seção dedicada acima) — vincula o catálogo às URLs já públicas via validação HTTP, sem depender de nenhuma credencial S3. Testado neste ambiente ponta a ponta contra um servidor HTTP local simulando o bucket público (já que o R2 real segue inalcançável por rede daqui): 203/203 processados com sucesso (160 importados + 43 atualizados, 0 falhos), segunda execução 100% idempotente (203 já_vinculados, zero chamada de rede desnecessária) — ver evidências completas no PR desta mudança.

O que foi comprovado neste ambiente, sem depender de rede R2 real:
- Testes automatizados (mocks de `fetch`/`S3Client`, Postgres real de desenvolvimento) cobrindo os dois modos: upload/validação bem-sucedidos, falhas (403/404/`Access Denied`/confirmação divergente), idempotência, validação de manifesto, exercício inexistente/de origem errada, ausência de segredos no relatório, retentativa limitada para 429/5xx/rede, fallback HEAD→GET.
- `--public-only` real ponta a ponta contra um servidor HTTP local (não mockado) servindo os 203 arquivos de `public/media/exercises/`, com um `Exercise` real do Postgres de desenvolvimento: 203/203 vinculados, idempotência confirmada numa segunda execução, revertido ao final (dado de teste local, não homologação).

**Verificação ainda em aberto, fora do alcance deste agente**: rodar `--public-only` de fato contra o R2 real em homologação e os passos 4-8 do "Procedimento de homologação e promoção" acima (contagem de objetos no bucket, `Exercise.imageUrl` no Postgres de homologação, amostragem de URLs por HTTP, `/painel/exercicios` renderizando de fato) dependem de acesso direto ao Railway/R2/Postgres de homologação — continuam como responsabilidade de quem tiver esse acesso.

## Rollback

- `npm run catalog:import-imagens-exercicios -- --revert`: limpa `imageUrl`/`imageAlt` de todo `Exercise` `FITOS_CURATED` referenciado pelo manifesto atual. Nunca apaga o `Exercise` em si.
- **Nunca apaga objetos do bucket R2** por padrão — um objeto órfão (sem nenhum `Exercise.imageUrl` apontando pra ele) não é servido a ninguém e não representa risco; exclusão de objeto exigiria uma flag explícita adicional, ainda não implementada (risco desproporcional ao benefício nesta fase).
- Para validar que o rollback terminou sem imagens quebradas: repetir o passo 7 do procedimento de homologação (abrir `/painel/exercicios`) — `ExerciseThumbnail` já trata `imageUrl` nulo com o placeholder "Sem imagem", nunca um ícone de imagem quebrada do navegador.

## Riscos e controles de segurança

- Upload é exclusivamente server-side (dentro do script CLI administrativo) — nenhuma rota HTTP pública expõe upload, nenhum código de cliente instancia o `S3Client`.
- Credenciais nunca aparecem em log, relatório, PR ou documentação — só nomes de variável, nunca valores, em qualquer mensagem de erro (`R2ConfigError`, mensagens de falha de upload).
- URL pública do R2 nunca é assinada (bucket servido publicamente, mesmo modelo de exposição que o caminho estático local já tinha) — não há segredo na própria URL da imagem.
- `next.config.mjs` restringe `remotePatterns` ao hostname exato de `R2_PUBLIC_BASE_URL`, nunca um curinga amplo.

## Ampliação FIT-118 — de 43 para 203/208

Um segundo lote de 208 fotografias aprovadas foi recebido (nomes de arquivo já em slug, `.webp`, uma imagem por `canonical_key` do catálogo curado — `src/modules/exercises/data/catalogo-exercicios-fitos-ptbr.csv`). Reconciliação feita antes de qualquer gravação:

- **Conferência 1:1**: os 208 slugs do lote batem exatamente com os 208 `canonical_key` do CSV — zero ausentes, zero sobrando, zero duplicado.
- **7 arquivos do lote vieram vazios** (0 bytes) — falha de exportação do lote recebido, confirmada por inspeção direta do zip antes de tocar em qualquer arquivo do repositório: `alongamento-de-gluteo-deitado`, `barra-australiana`, `elevacao-lateral-inclinada`, `leg-press-45`, `panturrilha-no-leg-press`, `rosca-direta-com-barra-w`, `rosca-scott-na-maquina`.
- Desses 7: **2 já tinham imagem no lote anterior de 43** (`leg-press-45`, `rosca-direta-com-barra-w`) — mantidos como estavam (arquivo e entrada de manifesto antigos preservados, não regenerados); os outros **5 nunca tiveram ilustração em nenhum lote e continuam sem imagem** (`Exercise.imageUrl` permanece `null` para eles, mesmo comportamento de antes — sem regressão).
- As 40 imagens do lote de 43 que tinham correspondente no lote novo foram **substituídas** (bytes diferentes, resolução maior — mesmo exercício, lote de produção mais recente), para manter consistência visual entre as 201 imagens novas e as poucas antigas que sobraram.
- Dimensões reais variam por arquivo (1254×1254, 512×512, 418×627 confirmados por amostragem) — nunca assumidas fixas; `width`/`height` do manifesto refletem o arquivo real de cada entrada (metadado informativo, a renderização usa contêiner fixo com `object-fit: cover` em `ExerciseThumbnail`, não é afetada por isso).
- `--dry-run` local confirmou o resultado: `encontrados=203 já_vinculados=0 novos=160 atualizáveis=43 ausentes=0 outros_falhos=0`.

**Decisão de Produto (Murilo, 27/09/2026): aceitar 203/208 como estado final, não perseguir os 5 restantes.** As 5 imagens vazias (`alongamento-de-gluteo-deitado`, `barra-australiana`, `elevacao-lateral-inclinada`, `panturrilha-no-leg-press`, `rosca-scott-na-maquina`) deixam de ser tratadas como pendência de reenvio — `Exercise.imageUrl` permanece `null` para esses 5 exercícios de forma permanente (por decisão, não por falha técnica), com o mesmo fallback visual "Sem imagem" (`ExerciseThumbnail`) que qualquer exercício sem ilustração já usa. Se um lote corrigido for enviado no futuro, a mesma reexecução do importador os inclui sem duplicar nada (chave determinística por slug) — mas isso deixou de ser um item aberto desta História.

## Pendências reais

- Cobertura de imagens: **203/208**, aceita como estado final por decisão de Produto (ver acima) — não é mais uma pendência em aberto.
- O teaser da biblioteca na landing (`src/app/page.tsx`, seção `#biblioteca`) continua servindo os arquivos locais diretamente (não consulta `Exercise.imageUrl`, não foi migrado para R2 nesta rodada) — ver ADR-011.
- Exclusão controlada de objetos órfãos no bucket (flag explícita + confirmação) não foi implementada — não havia caso de uso real para priorizar isso nesta rodada.
