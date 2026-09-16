# EPIC-05 — Exercícios e Catálogo

Status: concluída — todas as quatro Histórias mergeadas na SPRINT-06, com a pendência de importação real da API Ninjas declarada explicitamente no fechamento (`docs/05-sprints/SPRINT-06-CATALOGO-DE-EXERCICIOS.md`), nunca marcada como entregue.

## Resultado esperado

Sobre a base de identidade, autorização e gestão de alunos entregue pelas EPIC-03/EPIC-04 (SPRINT-04/SPRINT-05), dar ao personal um catálogo de exercícios utilizável: exercícios globais importados de fonte externa autorizada, exercícios próprios restritos ao próprio tenant, busca, filtros e detalhes. A consulta normal do catálogo funciona a partir do PostgreSQL, inclusive durante indisponibilidade da API externa.

## Histórias

### FIT-020 (#42) — Integração e prova técnica da API Ninjas

Como Engenharia, quero um client server-side isolado para a Exercises API (API Ninjas), com contrato validado e erros tratados, para que o restante do sistema nunca dependa diretamente do fornecedor externo.

### FIT-021 (#43) — Importação e persistência do catálogo global

Como personal, quero que exercícios de uma fonte externa autorizada fiquem disponíveis localmente no catálogo, para que a consulta normal nunca dependa da disponibilidade da API externa.

### FIT-022 (#44) — Gestão de exercícios próprios

Como personal, quero cadastrar, editar, arquivar e reativar exercícios da minha própria conta, para complementar o catálogo quando a busca externa não atender.

### FIT-023 (#45) — Catálogo unificado, busca e detalhes

Como personal, quero buscar e filtrar exercícios globais e próprios em um único catálogo, com origem visível e detalhe de cada item, para montar minha biblioteca de trabalho.

## Dependências

EPIC-04 — Cadastro e Relacionamento com Alunos (#30), concluído: `main` contém autenticação, sessão, papéis, tenant derivado da sessão e o shell autenticado do personal (FIT-009 a FIT-016). `Exercise` (`tenantId` opcional, `origin`) e as triggers de isolamento (`enforce_workout_exercise_tenant`, `enforce_exercise_tenant_immutability`) já existem desde a FIT-007 (`prisma/migrations/20260916000000_add_tenant_composite_constraints`) — esta Épico estende esse modelo, nunca o substitui.

## Escopo

- client server-side isolado para a Exercises API (API Ninjas), com adapter para DTO interno;
- persistência local do catálogo global (migration aditiva), importação idempotente sob comando administrativo manual;
- exercícios próprios do personal: cadastro, edição, arquivamento e reativação, sempre restritos ao tenant da sessão;
- catálogo unificado no shell do personal: busca, filtros, paginação, detalhe, identificação visível de origem.

## Fora do escopo

- montagem, prescrição ou execução de treinos (`WorkoutExercise`/`TrainingPlan`/`Workout`, Fase 3 do roadmap);
- tradução por IA do conteúdo importado (texto original preservado, UI em português apenas nos rótulos do FitOS);
- upload/preview de imagem ou vídeo de execução;
- favoritos/recentes;
- qualquer papel adicional além de PERSONAL/ALUNO.

## Contrato com a API Ninjas — limites conhecidos

Conforme `docs/02-integracoes/INTEGRACAO-API-NINJAS.md` e a documentação oficial (consultada em 16/09/2026, https://api-ninjas.com/api/exercises): `GET /v1/exercises` retorna até 5 resultados por chamada, aceita `name`/`type`/`muscle`/`difficulty`/`equipments`, autentica por `X-Api-Key`; `offset` é recurso premium; `GET /v1/allexercises` exige plano Business ou superior (ou anual) e retorna apenas nomes por grupo muscular, não objetos completos; uso comercial exige assinatura premium. Nenhuma chave nova foi fornecida a esta Épico por canal seguro — a chave mencionada em conversa anterior é tratada como exposta e nunca reutilizada. Ver ADR-004 para a decisão completa e a classificação exata do que foi comprovado.

## Critérios de sucesso do Épico

- client e adapter testados por contrato (fixtures), sem depender de rede real;
- catálogo local consultável mesmo com a API externa indisponível;
- exercício próprio nunca muda de tenant nem se torna global; nenhum tenant lê/edita exercício próprio de outro;
- arquivamento nunca é exclusão física; vínculos existentes (quando houver, fora do escopo desta Épico) são preservados;
- catálogo unificado no shell do personal com busca, filtro, paginação e detalhe reais;
- situação real da licença/importação da API Ninjas declarada sem ambiguidade no fechamento — nenhuma integração real, importação em massa ou uso comercial afirmado com base em mock/fixture.

## Sequenciamento obrigatório

FIT-020 → (merge) → FIT-021 → (merge) → FIT-022 → (merge) → FIT-023 → (merge) → fechamento da SPRINT-06. Execução autônoma integral autorizada pelo Produto (SPRINT-06) — merge de cada PR ocorre após critérios de aceite e quality gates cumpridos e registrados no próprio PR, sem pausa intermediária entre Histórias.
