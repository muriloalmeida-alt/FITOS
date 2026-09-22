# Biblioteca ilustrada de exercícios (FIT-111, EPIC-14)

## Objetivo e escopo

Vincular as 43 ilustrações de exercício do pacote (`assets/exercicios/`, seção 8B de `PROMPT_CLAUDE_LANDING_ONBOARDING_FITOS.md`) ao catálogo global já existente (208 exercícios `FITOS_CURATED`, IMP-EX-002), expor a imagem no catálogo (`/painel/exercicios`) e no detalhe, e adicionar o teaser comercial na landing que a FIT-110 deixou deliberadamente pendente.

**Fora do escopo desta História**: os wizards completos de onboarding (FIT-112 a FIT-115); importar os 13 arquivos do pacote que não são ilustração de exercício (ver "Curadoria dos assets" abaixo); um catálogo de metadados novo (músculo/equipamento) — esses já existem em `Exercise` desde a FIT-021/IMP-EX-002 e são só lidos, nunca reescritos por esta História.

## Modelagem

`Exercise` ganhou dois campos opcionais (`imageUrl`, `imageAlt` — migration `20260922165202_add_exercise_image_fields`), nunca um model novo. A imagem é sempre um vínculo a um `Exercise` que **já existe** — este módulo nunca cria um exercício. Um catálogo próprio (`origin: "PERSONAL"`) nunca ganha imagem por este caminho (o pacote não pede isso, e criaria uma segunda forma de um personal "publicar" uma imagem, fora de escopo).

## Curadoria dos assets (regra de assets do pacote: "não usar o nome do arquivo como única fonte de verdade")

Dos 56 arquivos do pacote, 13 não são ilustração de um exercício específico e ficam **fora** desta importação (documentado aqui para rastreabilidade, não descartado — continuam disponíveis para uso de marketing/landing em Histórias futuras):

- 11 fotos institucionais/de produto (ex.: "Treino premium com personal trainer", já usada como hero da FIT-110; "FitOS em movimento"; capturas de tela do painel).
- "Demonstração de agachamento com barra.png" — foto genérica de agachamento sem indicação de fase, redundante com as três ilustrações de agachamento já mais específicas (búlgaro, frontal, livre — cada uma com sua própria imagem).
- "Supino reto com barra: execução segura.png" — segunda imagem para o mesmo exercício que "Supino reto com barra, duas fases.png" já cobre; como cada `Exercise` tem um único `imageUrl`, a versão "duas fases" foi escolhida (mostra mais informação de movimento) e a segunda ficou de fora, não descartada.

Os 43 arquivos restantes foram cada um mapeado manualmente ao `Exercise` correspondente do catálogo curado (por nome semântico, não por correspondência literal de string — ex.: "Avanço reverso com halteres.png" → exercício "Avanço com halteres"; "Puxada alta com pegada aberta.webp" → "Puxada alta pegada aberta"), registrado em `src/modules/exercises/data/manifesto-imagens-exercicios.json` com `canonicalKey` (a mesma chave estável `externalId` que a IMP-EX-002 já usa), `slug`, `musculo`, `equipamento`, `aliases` (nome original do arquivo, preservado) e `altText` (texto funcional do movimento — nunca o nome do arquivo).

## Assets

Otimizadas de PNG/WebP originais (~1MB cada, ~46MB no total) para WebP quality=82, redimensionadas a no máximo 800px de largura (~1,4MB no total) — `public/media/exercises/<slug>.webp`, mesmo padrão de nomenclatura e otimização já usado por `public/media/landing/` (FIT-110). Caminho estático público, nunca um bucket ou URL assinada (regra explícita do pacote) — servido diretamente pelo Next.js a partir de `public/`.

## Importação (idempotente, execução manual)

`src/modules/exercises/importExerciseImages.ts` + `scripts/import-imagens-exercicios.ts` (`npm run catalog:import-imagens-exercicios -- [--dry-run|--revert]`). Nunca chamado por build/seed/deploy.

- **Chave estável**: cada entrada do manifesto localiza seu `Exercise` por `[origin: "FITOS_CURATED", externalId: canonicalKey]` — o mesmo índice único que a IMP-EX-002 já usa. Sem correspondência → `falho`, nunca cria um exercício novo (protege contra duplicação).
- **Idempotência**: compara `imageUrl`/`imageAlt` atuais com o valor alvo antes de escrever; sem mudança → `ignorado`. Reexecutar sem alterar manifesto/imagens é sempre um no-op.
- **Falha parcial isolada**: cada entrada roda em seu próprio `try/catch` — uma falha (arquivo ausente, `canonicalKey` inexistente) nunca aborta o restante do lote nem deixa o catálogo num estado inconsistente.
- **Checksum**: sha256 do buffer da imagem, calculado a cada execução e reportado por item — rastreabilidade de que o arquivo físico realmente lido corresponde ao esperado. Não é persistido no banco (só os dois campos de imagem existem em `Exercise`); vive no relatório da execução.
- **Dry-run**: `--dry-run` simula (`simulado`) sem gravar.
- **Rollback/compensação**: `--revert` limpa `imageUrl`/`imageAlt` de todo `Exercise` referenciado pelo manifesto, sem apagar o exercício.
- **Resumo final**: total/importados/atualizados/ignorados/simulados/falhos — impresso no console, exigência explícita do pacote.

Execução real em homologação nesta História: 43/43 importados, 0 falhos; segunda execução (verificação de idempotência): 43/43 ignorados.

## UI do catálogo

`ExerciseThumbnail` (`src/shared/ui/`, novo) — Client Component com estado de "imagem indisponível": tanto a ausência de `imageUrl` quanto uma falha real de carregamento (`onError`) caem no mesmo placeholder textual ("Sem imagem"), nunca o ícone padrão de imagem quebrada do navegador. Reaproveitado em `/painel/exercicios` (lista, agora em cards com miniatura 96×96) e no detalhe (`/painel/exercicios/[id]`, imagem 320×320 com `priority`). Nenhuma mudança de contrato em `listCatalogExercises`/`getCatalogExerciseForTenant` — ambos já retornavam o `Exercise` completo, então `imageUrl`/`imageAlt` passaram a existir "de graça" assim que a migration foi aplicada.

Busca por nome e filtros por músculo/tipo/dificuldade (FIT-023) não mudaram — já atendiam à seção 8B do pacote antes desta História; só a apresentação de cada resultado ganhou imagem.

"Visualização das fases do movimento" (pedida pelo pacote) é resolvida pela própria escolha de asset: sempre que o pacote tinha uma versão "duas fases"/"início e final" de um exercício, essa foi a versão escolhida como `imageUrl` — a ilustração já mostra as duas fases numa única imagem; `altText` registra isso explicitamente (`duasFases: true` no manifesto) para leitor de tela.

## Teaser na landing (seção 8B, deferido da FIT-110)

Nova seção `#biblioteca` em `src/app/page.tsx`, entre "Comece pelo caminho certo" e "Personal e aluno, na mesma rotina". A contagem exibida (`{exerciseImageManifest.length}`) vem do próprio manifesto JSON importado estaticamente pelo Server Component — nunca um número hardcoded, então a landing nunca fica "enganosa" (exigência explícita do pacote) conforme mais ilustrações forem importadas em Histórias futuras: o texto sempre reflete a contagem real publicada, sem exigir uma segunda edição manual da landing. Texto "biblioteca em expansão" em vez de "quase 100" apresentado como já disponível — a mesma distinção que o pacote pede entre tamanho planejado e quantidade real. Quatro exemplos (um por músculo/padrão de movimento diferente, todos com "duas fases") ilustram o teaser; link de navegação "Exercícios" adicionado ao cabeçalho (desktop e mobile).

## Segurança e LGPD

Nenhum dado sensível. As imagens são ilustrações de exercício, não fotos de aluno real (a mesma regra de `docs/06-GOVERNANCA-DE-MIDIA.md` que já proíbe foto de aluno em `Avatar` não se aplica aqui — não há aluno envolvido). Caminho estático público (`/media/exercises/...`), sem autenticação — mesmo padrão de `/media/landing/` e `/media/brand/`, nenhuma nova superfície de autorização.

## Critérios de aceite (seção 8B + 17 do pacote) resolvidos por esta História

- [x] Manifesto de importação com nome canônico, slug, arquivo, músculos, equipamento e aliases.
- [x] Nomes normalizados para PT-BR sem perder o nome original (campo `aliases`).
- [x] Nenhum exercício duplicado — vínculo por chave estável a um `Exercise` já existente.
- [x] Imagens otimizadas (WebP), dimensões definidas, carregamento progressivo (`loading="lazy"` fora da primeira dobra).
- [x] Nenhum caminho interno/bucket/URL assinada exposto.
- [x] Alt text funcional do movimento.
- [x] Importação única, idempotente, com dry-run/checksum/relatório/resumo/rollback — nunca automática em deploy.
- [x] Busca por nome, filtro por músculo/equipamento/dificuldade, cards com imagem e metadados, detalhe, estados de carregamento/indisponível/vazio, mobile e acessível.
- [x] Teaser na landing com contagem real (nunca enganosa) e exemplos de duas fases.

## Testes executados

- `src/modules/exercises/importExerciseImages.integration.test.ts` (11 testes, PostgreSQL real): vínculo, idempotência, atualização, `canonicalKey` sem correspondência (falho, sem criar exercício), dry-run, falha isolada em lote, revert.
- `src/shared/ui/ExerciseThumbnail.test.tsx` (3 testes): imagem com alt, placeholder sem `src`, placeholder após `onError`.
- `src/app/painel/exercicios/page.test.tsx` / `[id]/page.test.tsx` (+3 testes novos): imagem exibida com alt funcional; placeholder quando não há imagem.
- `src/app/page.test.tsx` (+1 teste): teaser com contagem real, "biblioteca em expansão", disponibilidade para os três perfis.
- Suíte completa: 894/894. `tsc --noEmit`/`eslint .`/`npm run build` limpos.
- Importação real em homologação: 43/43 importados na primeira execução, 0 falhos; 43/43 ignorados na segunda (idempotência confirmada).

## Evidências

`docs/06-engenharia/evidencias/FIT-111/README.md` — capturas reais (desktop e mobile) da landing e do catálogo, com e sem imagem vinculada.

## Pendências reais

- Os 13 arquivos do pacote reclassificados como não-catálogo (ver "Curadoria dos assets") continuam disponíveis para uso futuro de marketing, sem História própria ainda.
- Os ~57 exercícios restantes do acervo planejado ("quase 100") dependem de novos assets do pacote — o pipeline de importação já suporta reexecução incremental sem nenhuma mudança de código.
