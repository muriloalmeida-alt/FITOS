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

## Testes

- `src/integrations/api-ninjas/client.test.ts`: resposta válida (preserva texto original), vazia, item sem nome, resposta não-lista, corpo não-JSON, lista/corpo excedendo os limites defensivos, 401/403/429/5xx, timeout (nunca fica pendente indefinidamente), variável de ambiente ausente (nenhuma tentativa de rede), a chave nunca aparece na URL nem em mensagens de erro, parâmetros da busca codificados corretamente (apenas os informados e não-vazios).
- `src/integrations/api-ninjas/adapter.test.ts`: preservação de texto original, campos ausentes/em branco tornando-se `null`, rejeição de item sem nome.
