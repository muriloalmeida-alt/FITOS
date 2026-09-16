# Catálogo de exercícios (SPRINT-06)

Este documento detalha a implementação da EPIC-05/SPRINT-06 (FIT-020 a FIT-023): integração com a Exercises API (API Ninjas), catálogo global importado, exercícios próprios do personal, e a listagem unificada no shell autenticado. Complementa (não substitui) `docs/02-integracoes/INTEGRACAO-API-NINJAS.md`, `docs/06-engenharia/arquitetura/INTEGRACAO-API-NINJAS.md` e `docs/06-engenharia/arquitetura/adr/ADR-004-API-NINJAS-EXERCICIOS.md`.

## FIT-020 — Client isolado da API Ninjas

`src/integrations/api-ninjas/` é o único ponto do FitOS que conhece o endpoint, o header de autenticação e o formato bruto da Exercises API. Nenhum outro módulo importa a API Ninjas diretamente — quem precisar de exercícios externos usa este pacote, nunca `fetch` direto para `api.api-ninjas.com`.

- `types.ts` — contrato externo (`ApiNinjasExerciseRaw`) e DTO interno (`ExerciseDTO`). Todo campo além de `name` é opcional no contrato externo — a documentação oficial não garante presença, e tratá-los como sempre preenchidos seria assumir uma garantia que o fornecedor não dá (ver ADR-004).
- `adapter.ts` — `toExerciseDTO`: normaliza texto (trim; ausente/vazio → `null`), preserva o conteúdo original (sem tradução — a UI do FitOS continua em português apenas nos próprios rótulos, não no conteúdo importado), rejeita item sem nome.
- `client.ts` — `searchExercises`: lê `API_NINJAS_API_KEY` de variável de ambiente (nunca aceita a chave como parâmetro, nunca loga seu valor); timeout configurável via `AbortController` (padrão 8s); erros tipados (`ApiNinjasError`) para `CHAVE_AUSENTE`, `NAO_AUTORIZADO` (401), `PROIBIDO` (403), `LIMITE_EXCEDIDO` (429), `ERRO_SERVIDOR` (5xx), `TIMEOUT`, `RESPOSTA_INVALIDA` (JSON malformado, não é lista, item sem nome, corpo ou lista maiores que o limite defensivo); `fetchImpl`/`timeoutMs` injetáveis exclusivamente para teste, mesmo padrão de DI já usado em `identity`/`students`/`tenancy`.
- `errors.ts` — `ApiNinjasError`, com `kind` tipado — nenhuma mensagem inclui a chave, a URL completa ou o corpo bruto da resposta.

### Limites defensivos

A documentação oficial limita `GET /v1/exercises` a 5 resultados por chamada e não oferece paginação fora do plano premium (`offset`). O client não presume esse número como garantia eterna do fornecedor: valida que a resposta é uma lista de no máximo 50 itens (rede de segurança contra uma resposta inesperadamente grande) e que o corpo da resposta não excede 1 MB como texto, antes mesmo de tentar `JSON.parse`.

### O que esta História não faz

- Nenhuma chamada real à API Ninjas foi feita ou é feita pelos testes — todos os 21 testes automatizados (`client.test.ts`, `adapter.test.ts`) substituem `fetch` por fixtures locais via `fetchImpl`.
- Nenhuma chave nova foi fornecida por canal seguro a esta Sprint — `API_NINJAS_API_KEY` permanece sem valor real em qualquer ambiente controlado por esta rodada. A chave mencionada em conversa anterior é tratada como exposta e nunca foi usada, recuperada, transcrita ou registrada em nenhum artefato.
- Nenhuma persistência — este pacote apenas consulta e normaliza; a importação/persistência é escopo da FIT-021.
- Classificação exata do que foi (e não foi) comprovado: `docs/06-engenharia/arquitetura/adr/ADR-004-API-NINJAS-EXERCICIOS.md`.

## Testes (FIT-020)

- `src/integrations/api-ninjas/client.test.ts`: resposta válida (preserva texto original), vazia, item sem nome, resposta não-lista, corpo não-JSON, lista/corpo excedendo os limites defensivos, 401/403/429/5xx, timeout (nunca fica pendente indefinidamente), variável de ambiente ausente (nenhuma tentativa de rede), a chave nunca aparece na URL nem em mensagens de erro, parâmetros da busca codificados corretamente (apenas os informados e não-vazios).
- `src/integrations/api-ninjas/adapter.test.ts`: preservação de texto original, campos ausentes/em branco tornando-se `null`, rejeição de item sem nome.

## FIT-021 — Importação e persistência do catálogo global

`src/modules/exercises/importExercises.ts` consome `searchExercises` (FIT-020) e persiste o resultado em `Exercise` com `tenantId: null`, `origin: "API_NINJAS"`.

### Migration aditiva

`prisma/migrations/20260916040000_add_exercise_catalog_fields/` adiciona a `exercises`: `type`, `muscle`, `equipments`, `difficulty`, `instructions`, `safetyInfo` (todos opcionais — espelham o contrato da API Ninjas) e `updatedAt` (`@updatedAt`, com `DEFAULT CURRENT_TIMESTAMP` na coluna física para nunca quebrar se algum ambiente já tiver linhas). Cria também o índice único `exercises_origin_externalId_key`. Nenhuma migration anterior foi editada; os dois triggers de isolamento (`enforce_workout_exercise_tenant`, `enforce_exercise_tenant_immutability`) permanecem intactos — testado explicitamente aplicando a migration em banco vazio (histórico completo do zero) e como atualização do schema atual (`fitos_dev`/`fitos_test`, ambos sem nenhuma linha em `exercises` neste momento).

### Deduplicação determinística

A Exercises API não retorna um identificador estável. `buildExternalId(dto)` calcula um hash SHA-256 de `name|type|muscle|equipments` normalizados (minúsculas, sem espaço nas pontas) — **deliberadamente sem** `difficulty`/`instructions`/`safetyInfo`: esses são atributos descritivos que podem ser corrigidos pelo fornecedor sem que isso signifique um exercício diferente; incluí-los na chave faria uma correção de dificuldade criar um duplicado em vez de atualizar o registro existente (achado durante o desenvolvimento — o primeiro teste de reimportação com dificuldade alterada falhou exatamente por esse motivo, confirmando a necessidade da exclusão).

### Upsert idempotente e concorrência seguras

`upsertGlobalExercise` tenta `create`; se a constraint única `[origin, externalId]` rejeitar (já existe), faz `update` em vez de duplicar ou lançar erro — mesmo padrão de `ensureTenantForPersonal` (FIT-010). Comprovado com teste de concorrência real (`Promise.all`, duas importações simultâneas do mesmo exercício — exatamente uma cria, a outra atualiza, nunca duas linhas).

### Falha parcial

`importGlobalExercises` itera múltiplas buscas; uma busca que falhar (API indisponível, erro de rede) é contada em `failedSearches` e a importação continua com as demais — registros já importados de buscas anteriores na mesma chamada nunca são desfeitos.

### Comando administrativo

`scripts/import-exercicios.ts` (`npm run import:exercises`) — execução manual apenas, nunca automática (sem gatilho no build, seed, deploy ou acesso à página). Protegido pela ausência de credencial: sem `API_NINJAS_API_KEY`, encerra imediatamente com mensagem explícita, sem nenhuma chamada de rede nem escrita no banco (comprovado: `npm run import:exercises` sem a variável configurada). O script roda com `NODE_OPTIONS=--conditions=react-server` para resolver o marcador `server-only` (usado por `client.ts`, FIT-020) para seu stub vazio fora do bundler do Next.js — mesma resolução que o Next.js aplica em Server Components, replicada aqui para uma execução Node pura.

### Importação real — situação declarada

Nenhuma chamada real foi feita nesta rodada (ver ADR-004): sem chave nova nem confirmação de plano/licença comercial, o gatilho real permanece indisponível por construção (a ausência da variável de ambiente é a própria proteção). Nenhum ambiente de homologação foi preenchido com catálogo externo.

## Testes (FIT-021)

`src/modules/exercises/importExercises.integration.test.ts` (Postgres real, `searchFn` substituído por fixtures — nenhuma chamada real): exercício novo criado com `tenantId` nulo/`origin: API_NINJAS`/`externalId` determinístico; reimportação com dado alterado atualiza em vez de duplicar; falha parcial preserva o que já foi importado; resposta vazia sem erro; duas importações concorrentes do mesmo exercício nunca duplicam; `buildExternalId` determinístico e sensível a diferenças relevantes.

## FIT-022 — Gestão de exercícios próprios

`src/modules/exercises/exercises.ts`: `createOwnExercise`, `getOwnExerciseForTenant`, `updateOwnExercise`, `archiveExercise`, `reactivateExercise` — mesmo padrão de `students.ts` (FIT-013/014): `tenantId` sempre derivado da sessão pelo chamador (nunca parâmetro opcional/inferido), nenhuma função aceita `tenantId`/`origin` como campo editável.

### Migration aditiva

`prisma/migrations/20260916050000_add_exercise_status/` adiciona `ExerciseStatus` (`ATIVO`/`ARQUIVADO`, default `ATIVO`) e a coluna `status` em `Exercise`; remove o `DEFAULT` físico não declarado de `updatedAt` (drift da migration anterior, sem efeito de comportamento — toda escrita via Prisma já define o valor); cria um índice único parcial `exercises_personal_tenant_name_key` em `(tenantId, lower(name)) WHERE origin = 'PERSONAL'` — não representável no Prisma Schema (mesma limitação já documentada para os TRIGGERs de isolamento). Testada em banco vazio (histórico completo do zero) e como atualização do schema atual (`fitos_dev`/`fitos_test`).

### Regras aplicadas

- **Nunca muda de tenant nem se torna global**: nenhuma função aceita `tenantId`/`origin` como entrada editável; a imutabilidade de `tenantId` quando já referenciado por um `WorkoutExercise` é garantida fisicamente por `enforce_exercise_tenant_immutability` (FIT-007) — dupla proteção, não uma alternativa à outra.
- **Isolamento**: `getOwnExerciseForTenant` (e todas as funções que dependem dela) nunca retorna um exercício de outro tenant nem um exercício global — mesmo com o `id` correto. `NAO_ENCONTRADO` nesses casos, nunca revelando se o registro existe em outro tenant/no catálogo global (mesmo padrão de `getStudentForTenant`).
- **Duplicidade**: dois exercícios PRÓPRIOS do mesmo tenant não podem ter o mesmo nome normalizado (minúsculas), ativo ou arquivado — imposto pelo índice único parcial acima, traduzido para `ExerciseError("NOME_DUPLICADO_NO_TENANT")`. Reativar um exercício arquivado é o caminho para "reusar" o nome, em vez de criar um novo.
- **Arquivamento**: idempotente (mesmo padrão de `inactivateStudent`/`reactivateStudent`), nunca exclusão física — a linha nunca é removida, apenas `status`.
- **Auditoria**: `AuditEvent` (`EXERCICIO_ARQUIVADO`/`EXERCICIO_REATIVADO`/`EXERCICIO_EDITADO`) gravado na mesma transação da mudança de estado, nunca com o payload integral (apenas `tenantId`/`actorUserId`/`entityType`/`entityId`). Criação não gera evento — mesmo padrão de `createStudent` (o próprio registro e seu `createdAt` já são o rastro; auditoria aqui é para ações sobre um registro existente).
- **Aluno não administra exercícios**: as rotas (`/api/exercises`, `/api/exercises/[id]`, `.../arquivar`, `.../reativar`) usam `requirePersonal()` (FIT-011) — a mesma checagem de sessão/papel de todas as rotas de personal desta aplicação.

### Rotas

- `POST /api/exercises` — cadastro.
- `PATCH /api/exercises/[id]` — edição.
- `POST /api/exercises/[id]/arquivar` — arquivamento.
- `POST /api/exercises/[id]/reativar` — reativação.

Nenhuma rota de listagem/detalhe nesta História — a listagem unificada (catálogo global + próprio) e o detalhe são escopo exclusivo da FIT-023, que também entrega a superfície de UI (esta História é inteiramente backend: módulo de domínio + rotas + testes).

## Testes (FIT-022)

- `src/modules/exercises/exercises.integration.test.ts` (Postgres real): criação (sempre `PERSONAL`/`ATIVO`/`externalId` nulo), validação de nome vazio, duplicidade no mesmo tenant (case-insensitive) rejeitada, mesmo nome em tenants diferentes permitido, isolamento cruzado (nunca retorna exercício de outro tenant nem exercício global), edição preservando `tenantId`/`origin`/`status`, edição/arquivamento/reativação de exercício de outro tenant rejeitados (`NAO_ENCONTRADO`), arquivamento/reativação idempotentes sem exclusão física, auditoria gravada em arquivar/reativar, operações sobre id inexistente.
- `src/app/api/exercises/**/*.test.ts`: 401 sem sessão, 403 quando o autenticado é aluno (rota de criação), tenant sempre da sessão mesmo quando o corpo tenta enviar `tenantId`/`origin` diferentes, 404 quando o exercício não pertence ao tenant da sessão, 400 em validação/duplicidade.
