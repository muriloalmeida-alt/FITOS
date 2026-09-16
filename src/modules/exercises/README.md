# Módulo: Exercícios

Responsabilidade: catálogo local — exercícios globais importados e exercícios próprios do personal.

## `importExercises.ts` (FIT-021)

Importação e persistência do catálogo global (`origin: API_NINJAS`, `tenantId: null`). Consome `src/integrations/api-ninjas`, nunca chama a API diretamente. Só é executado pelo comando administrativo manual (`scripts/import-exercicios.ts`) — nunca automaticamente. Detalhes em `docs/06-engenharia/arquitetura/CATALOGO-DE-EXERCICIOS.md`.

Gestão de exercícios próprios do personal (FIT-022) e catálogo unificado (FIT-023) chegam nas próximas Histórias desta mesma Sprint.
