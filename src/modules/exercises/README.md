# Módulo: Exercícios

Responsabilidade: catálogo local — exercícios globais importados e exercícios próprios do personal.

## `importExercises.ts` (FIT-021)

Importação e persistência do catálogo global (`origin: API_NINJAS`, `tenantId: null`). Consome `src/integrations/api-ninjas`, nunca chama a API diretamente. Só é executado pelo comando administrativo manual (`scripts/import-exercicios.ts`, `npm run catalog:import-api-ninjas`) — nunca automaticamente. Detalhes em `docs/06-engenharia/arquitetura/CATALOGO-DE-EXERCICIOS.md`.

Gestão de exercícios próprios do personal (FIT-022) e catálogo unificado (FIT-023) chegaram nas Histórias seguintes da mesma Sprint (SPRINT-06).

## `catalogImportManifest.ts` / `catalogImportRun.ts` (IMP-EX-001, pacote pós-MVP)

Trava, retomada e manifesto versionado da carga única do catálogo — ver `docs/06-engenharia/arquitetura/INTEGRACAO-API-NINJAS.md`. Não é uma História FIT; é o pré-requisito operacional antes do EPIC-12 (Monetização).
