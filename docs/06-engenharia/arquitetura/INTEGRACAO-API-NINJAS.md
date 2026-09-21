# Arquitetura da integração API Ninjas

Este documento complementa `docs/02-integracoes/INTEGRACAO-API-NINJAS.md`.

## Fluxo real (corrigido pela IMP-EX-001 — pacote pós-MVP, 21/09/2026)

A versão original deste documento (Fase 0) descrevia um fluxo de consulta "sob demanda" — o adaptador chamando a API Ninjas quando o catálogo local não bastasse. **Isso nunca foi o que a EPIC-05/SPRINT-06 implementou** (nem deveria ser, por decisão explícita do pacote pós-MVP): `listCatalogExercises`/`getCatalogExerciseForTenant` (`src/modules/exercises/exercises.ts`) sempre leram exclusivamente do PostgreSQL, desde a FIT-023 — nenhuma busca do personal ou do aluno jamais chamou a rede. A redação antiga estava desalinhada com o código real; corrigida aqui para não induzir a reintroduzir consulta online por engano.

1. a API Ninjas é consultada **apenas** pelo comando administrativo de importação (`scripts/import-exercicios.ts`, `npm run catalog:import-api-ninjas`), nunca pelo caminho de busca do usuário;
2. a importação roda uma única vez por ambiente (IMP-EX-001) e grava no catálogo local (`Exercise`, `origin: API_NINJAS`, `tenantId: null`);
3. toda consulta normal (Personal, Aluno, futuramente FitOS Livre) lê exclusivamente do PostgreSQL — indisponibilidade, mudança de preço ou encerramento da API Ninjas não afeta o uso normal;
4. exercício selecionado referencia o ID interno (`Exercise.id`); nenhum treino depende da API externa em execução;
5. não existe cron, sincronização periódica, consulta sob demanda ou endpoint público que dispare a importação — reimportação só ocorre por reexecução manual do comando, e uma segunda execução após sucesso (`COMPLETED`) é recusada por padrão (ver seção abaixo).

## IMP-EX-001 — carga única do catálogo

Especificação completa: pacote `FitOS_Pacote_Pos_MVP_Fases_2_1_Monetizacao_2_2_Livre_v3`, documento `15_IMPORTACAO_UNICA_API_NINJAS.md`. Implementação:

- `src/modules/exercises/catalogImportManifest.ts` — manifesto versionado de consultas (hoje: 10 grupos musculares documentados desde a FIT-021/ADR-004; dimensões `type`/`difficulty`/`equipments` não entram por não terem enumeração confirmada por consulta independente — ver comentário no arquivo) e hash determinístico do manifesto.
- `src/modules/exercises/catalogImportRun.ts` — ciclo de vida `PENDING → RUNNING → COMPLETED|FAILED` em `CatalogImportRun` (`prisma/migrations/20260921161719_add_catalog_import_run`). Trava real contra execução concorrente e contra segunda carga completa: dois índices únicos parciais em `(provider, environment)`, um `WHERE status = 'RUNNING'` e outro `WHERE status = 'COMPLETED'` — não representáveis em `schema.prisma`, adicionados à mão na migration, mesmo padrão dos TRIGGERs de tenant já documentados no comentário do model `Exercise`.
- Retomada: reexecutar o mesmo comando após uma falha (`FAILED`) continua automaticamente do `checkpoint` salvo, desde que o manifesto seja idêntico (mesmo hash) — nenhuma flag adicional.
- Reimportação após `COMPLETED`: recusada por padrão; exige `--force-reimport --justificativa=... --autorizado-por=...` (critério 5 do IMP-EX-001 — autorização de Produto e justificativa auditada, gravadas em `CatalogImportRun.forceReimportNote`).
- `--dry-run`: valida credencial, contrato e volume com chamadas reais de leitura à API Ninjas, mas nunca grava no banco nem cria uma linha em `CatalogImportRun`.
- Produção exige `--autorizar-producao` além de `--autorizado-por` — nenhuma execução em produção só com a variável de ambiente configurada.

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
