# Arquitetura da integração API Ninjas

Este documento complementa `docs/02-integracoes/INTEGRACAO-API-NINJAS.md`.

## Fluxo real (corrigido pela IMP-EX-001 — pacote pós-MVP, 21/09/2026)

A versão original deste documento (Fase 0) descrevia um fluxo de consulta "sob demanda" — o adaptador chamando a API Ninjas quando o catálogo local não bastasse. **Isso nunca foi o que a EPIC-05/SPRINT-06 implementou** (nem deveria ser, por decisão explícita do pacote pós-MVP): `listCatalogExercises`/`getCatalogExerciseForTenant` (`src/modules/exercises/exercises.ts`) sempre leram exclusivamente do PostgreSQL, desde a FIT-023 — nenhuma busca do personal ou do aluno jamais chamou a rede. A redação antiga estava desalinhada com o código real; corrigida aqui para não induzir a reintroduzir consulta online por engano.

1. a API Ninjas é consultada **apenas** pelo comando administrativo de importação (`scripts/import-exercicios.ts`, `npm run catalog:import-api-ninjas`), nunca pelo caminho de busca do usuário;
2. a importação roda uma única vez por ambiente (IMP-EX-001) e grava no catálogo local (`Exercise`, `origin: API_NINJAS`, `tenantId: null`);
3. toda consulta normal (Personal, Aluno, futuramente FitOS Livre) lê exclusivamente do PostgreSQL — indisponibilidade, mudança de preço ou encerramento da API Ninjas não afeta o uso normal;
4. exercício selecionado referencia o ID interno (`Exercise.id`); nenhum treino depende da API externa em execução;
5. não existe cron, sincronização periódica ou consulta sob demanda; a importação é sempre acionada manualmente — pelo comando administrativo (padrão) ou, por uma exceção de governança registrada e datada, por uma rota HTTP interna e protegida (ver seção "Exceção — rota HTTP interna" abaixo) — nunca automaticamente. Uma segunda execução após sucesso (`COMPLETED`) é recusada por padrão em ambos os casos (ver seção abaixo).

## IMP-EX-001 — carga única do catálogo

Especificação completa: pacote `FitOS_Pacote_Pos_MVP_Fases_2_1_Monetizacao_2_2_Livre_v3`, documento `15_IMPORTACAO_UNICA_API_NINJAS.md`. Implementação:

- `src/modules/exercises/catalogImportManifest.ts` — manifesto versionado de consultas (hoje: 10 grupos musculares documentados desde a FIT-021/ADR-004; dimensões `type`/`difficulty`/`equipments` não entram por não terem enumeração confirmada por consulta independente — ver comentário no arquivo) e hash determinístico do manifesto.
- `src/modules/exercises/catalogImportRun.ts` — ciclo de vida `PENDING → RUNNING → COMPLETED|FAILED` em `CatalogImportRun` (`prisma/migrations/20260921161719_add_catalog_import_run`). Trava real contra execução concorrente e contra segunda carga completa: dois índices únicos parciais em `(provider, environment)`, um `WHERE status = 'RUNNING'` e outro `WHERE status = 'COMPLETED'` — não representáveis em `schema.prisma`, adicionados à mão na migration, mesmo padrão dos TRIGGERs de tenant já documentados no comentário do model `Exercise`.
- Retomada: reexecutar o mesmo comando após uma falha (`FAILED`) continua automaticamente do `checkpoint` salvo, desde que o manifesto seja idêntico (mesmo hash) — nenhuma flag adicional.
- Reimportação após `COMPLETED`: recusada por padrão; exige `--force-reimport --justificativa=... --autorizado-por=...` (critério 5 do IMP-EX-001 — autorização de Produto e justificativa auditada, gravadas em `CatalogImportRun.forceReimportNote`).
- `--dry-run`: valida credencial, contrato e volume com chamadas reais de leitura à API Ninjas, mas nunca grava no banco nem cria uma linha em `CatalogImportRun`.
- Produção exige `--autorizar-producao` além de `--autorizado-por` — nenhuma execução em produção só com a variável de ambiente configurada.

## Exceção — rota HTTP interna (`POST`/`GET /api/admin/catalog-import`)

O IMP-EX-001 (pacote pós-MVP, seção 8) proíbe explicitamente "manter endpoint público para disparar a importação". Esta seção registra uma exceção pontual a essa regra, decidida por Murilo em 21/09/2026, porque o acesso SSH/CLI ao Railway não funcionou no momento em que a carga real precisava ser executada.

**Decisão**: criar `src/app/api/admin/catalog-import/route.ts`, reaproveitando a mesma orquestração do comando administrativo (`src/modules/exercises/catalogImportOrchestrator.ts` — extraída nesta rodada para ser a única implementação usada pelas duas entradas, comando e rota, nunca duplicada).

**Guarda-corpos, para reduzir o risco aceito**:

- **Não é pública de fato**: sem a variável `CATALOG_IMPORT_TRIGGER_SECRET` configurada, a rota responde 404 em qualquer método — comporta-se como se não existisse. Com a variável configurada, ainda responde 404 para qualquer requisição sem o header `X-Import-Trigger-Secret` correto (comparação em tempo constante, `src/shared/lib/secretCompare.ts` — nunca revela se a variável está ausente ou se o segredo está errado, nem por status nem por tempo de resposta).
- **Segredo próprio, nunca reaproveitado**: `CATALOG_IMPORT_TRIGGER_SECRET` é uma variável de ambiente separada de `API_NINJAS_API_KEY`/`BETTER_AUTH_SECRET` — nunca o mesmo valor para dois propósitos.
- **`POST` e `GET`, nunca `PUT`/`PATCH`/`DELETE`**: `PUT`/`PATCH`/`DELETE` respondem 404, não 405 — não confirmam que a rota existe para quem não tem o segredo. `GET` foi adicionado em 21/09/2026 como **exceção adicional**, decidida por Murilo depois que a ferramenta disponível para chamar a rota não conseguia enviar `POST` — risco aceito à parte, descrito abaixo. Parâmetros chegam pela query string no `GET` (`?environment=homologacao&dryRun=true&autorizadoPor=...`) e pelo corpo JSON no `POST`; o segredo continua exigido só pelo header `X-Import-Trigger-Secret` nos dois casos — nunca por query string, para nunca aparecer em log de acesso.
- **Nunca linkada em nenhuma navegação/UI da aplicação** — só é alcançável por quem souber a URL e tiver o segredo.
- **Mesma validação e mesma trava do comando administrativo**: `parseCatalogImportRequest` (`src/modules/exercises/catalogImportRequest.ts`) e o ciclo de vida de `CatalogImportRun` (índices únicos parciais) são exatamente os mesmos — a rota não abre um caminho mais permissivo que o comando, só um transporte diferente.
- **Nenhum segredo na resposta**: erros inesperados retornam `{ ok: false, error: "ERRO_INTERNO" }` genérico (nunca a mensagem original) — testado explicitamente (`route.test.ts`).

**Risco aceito, não eliminado**: quem tiver o segredo pode acionar a carga real (gastando as chamadas do plano contratado da API Ninjas) sem precisar de sessão autenticada na aplicação — por isso o segredo deve ser tratado com o mesmo cuidado de uma credencial de produção, nunca colado em conversa/chat, e gerado por canal seguro.

**Risco adicional aceito do `GET`**: diferente de `POST`, uma URL `GET` pode ser pré-carregada por navegador, cacheada por proxy/CDN, ou reenviada automaticamente por alguma ferramenta HTTP após uma falha de rede — qualquer uma dessas situações acionaria a carga sem intenção de quem a chamou. Murilo foi informado desse risco especificamente (distinto do risco geral do endpoint) e decidiu aceitá-lo em 21/09/2026 porque a alternativa (só `POST`) não funcionava com a ferramenta disponível no momento. A mesma trava de `CatalogImportRun` (execução única/concorrente) limita o dano de um disparo repetido, mas não elimina o consumo de uma chamada de rede indevida.

**Plano de retirada**: remover a rota (ou, no mínimo, desconfigurar `CATALOG_IMPORT_TRIGGER_SECRET` no Railway) assim que a carga real for concluída e confirmada, ou assim que o acesso SSH/CLI ao Railway for restabelecido — o que ocorrer primeiro. Esta rota não deve ser reaproveitada para nenhum outro job futuro sem uma nova decisão de Produto registrada.

## Controles

- segredo exclusivamente no Railway/backend;
- timeout e retry limitado com backoff apenas para falhas transitórias;
- limite de chamadas e cache conforme contrato do provedor;
- logs sem chave e sem payload sensível;
- deduplicação por origem, identificador externo e chave normalizada;
- métricas de latência, erro, limite e cache;
- falha externa não impede acesso ao catálogo já importado;
- exercício próprio continua disponível.

## Gate comercial

Antes da produção, confirmar plano, licença comercial, limites, atribuição, retenção/cache e campos efetivamente retornados. Divergências exigem atualização documental por PR.

## Segurança da credencial

Qualquer chave compartilhada em conversa deve ser considerada exposta e rotacionada. O pacote e o repositório nunca devem conter o valor real.
