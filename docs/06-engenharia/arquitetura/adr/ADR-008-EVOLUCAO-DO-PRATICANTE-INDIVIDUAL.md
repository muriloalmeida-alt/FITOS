# ADR-008 — Evolução do praticante individual: derivada, nunca um novo modelo de execução; metas genéricas; fotos privadas deferidas

Status: **Aceito** (FIT-104, EPIC-13 — FitOS Livre)
Data: 22 de setembro de 2026

## Contexto

FIT-104 ("Acompanhar evolução") pede seis coisas: histórico, frequência, recordes, medidas, metas e fotos privadas. Precisava de seis decisões de modelagem, não uma — cada uma foi resolvida separadamente, verificando primeiro se algo já existente resolvia o problema antes de desenhar algo novo (mesmo método já seguido pela FIT-102/FIT-103 com `workouts.ts`/`sessions.ts`).

## Decisões

**1. Histórico, frequência e recordes nunca são um novo modelo — são sempre derivados de `WorkoutSession`/`WorkoutSessionResult` (FIT-041), em leitura.** Nenhuma linha nova é gravada para nenhuma das três: `listSessionHistoryForStudent`/`getFrequencySummaryForStudent`/`listPersonalRecordsForStudent` (novo módulo `src/modules/execution/history.ts`) só consultam o que a execução (FIT-041/FIT-103) já grava. "Recorde" precisou de uma decisão própria: `loadUsed` é texto livre desde a FIT-041 (nunca um número estruturado — "peso corporal" é um valor válido), então um recorde é a maior carga que dá para **extrair** de `loadUsed` com uma extração numérica simples (`/(\d+(?:[.,]\d+)?)/`), por exercício; cargas sem número extraível (ex.: "peso corporal") não entram no ranking — não é um erro, apenas não participam.

**2. Medidas corporais reaproveitam `Assessment`/`BodyMeasurement` (FIT-042) sem alteração — muda apenas quem é o autor.** `createAssessment` já recebe `actorUserId` e `studentId` como parâmetros independentes, sem nenhuma lógica de papel embutida. Para o praticante individual, `actorUserId === ctx.userId`, a mesma pessoa que está sendo avaliada — via rotas próprias (`/api/minhas-avaliacoes/*`), nunca as rotas do personal. O comentário em `assessments.ts` ("avaliação... sempre autorada pelo personal... nunca pelo próprio aluno") continua verdadeiro para o caso ALUNO+PERSONAL que ele documenta — essa regra protege contra o aluno adulterar a própria avaliação enquanto tem um personal responsável por ela; esse risco não existe quando não há personal.

**3. Metas são um modelo novo (`Goal`), mas genérico por `[studentId, tenantId]` — nunca amarrado a `INDIVIDUAL`.** Ao contrário de `Assessment`, toda meta é criada/concluída/abandonada pelo próprio dono, então `goals.ts` nunca recebe um `actorUserId` diferente de quem a possui. `description` é texto livre (um enum fechado engessaria metas que o produto nunca vai conseguir prever todas). Ser genérico por `Student` (não por `INDIVIDUAL`) significa que um aluno com personal poderá ganhar a mesma tela no futuro sem nenhuma migração nova — só rotas/páginas próprias, o mesmo padrão já usado para todo o resto.

**4. Fotos privadas ficam deliberadamente fora desta implementação.** Não é uma omissão silenciosa: `docs/06-engenharia/arquitetura/DECISOES-PENDENTES.md` já registra, desde antes desta História, "Provedor S3 compatível | Engenharia | antes de fotos/anexos | bloqueia arquivos" como decisão pendente de Engenharia. Implementar upload de imagem sem essa decisão significaria inventar uma solução de armazenamento (ex.: bytea no Postgres) só para "ter a feature", o tipo de decisão especulativa que este projeto evita — o mesmo motivo pelo qual `assessments.ts` (FIT-042) já tinha deixado fotos de evolução fora de escopo antes mesmo de haver uma Issue pedindo a feature.

## Alternativas consideradas

1. **Um novo modelo `WorkoutHistory`/`PersonalRecord` materializado, atualizado a cada sessão concluída.** Rejeitada: `WorkoutSession`/`WorkoutSessionResult` já contêm toda a informação necessária; materializar seria duplicar dado e abrir espaço para o dado materializado divergir do dado de origem, sem nenhum ganho de performance que a escala atual do produto justifique.
2. **Recorde como número estruturado, migrando `loadUsed` de `String` para algo tipado.** Rejeitada: mudaria o contrato de `recordSessionResult` (FIT-041) e da tela de execução (FIT-103) só para servir a esta História — "peso corporal", "banda elástica vermelha" são cargas reais e válidas que um campo numérico não representaria; a extração heurística resolve o caso comum (cargas em kg) sem quebrar o caso livre.
3. **`Goal` como campo dentro de `IndividualProfile`.** Rejeitada: uma pessoa tem várias metas ao longo do tempo, com estados independentes (`EM_ANDAMENTO`/`CONCLUIDA`/`ABANDONADA`) — é uma lista com ciclo de vida próprio, não um atributo de perfil.
4. **Implementar fotos privadas com armazenamento provisório em Postgres (bytea/base64), para não bloquear a História.** Rejeitada: contorna a decisão pendente já registrada em vez de respeitá-la, e trocaria "bloqueado por decisão explícita de Engenharia" por "código de produção rodando numa solução de armazenamento que ninguém decidiu ser aceitável" — pior que esperar a decisão.

## Consequências

- `/painel/minha-evolucao` (rota própria, nunca `/painel/progresso` — exclusiva do `requireStudent()` da FIT-042) é a única tela que expõe histórico/frequência/recordes/medidas/metas ao praticante individual; o item de navegação "Progresso" deixa de ser `comingSoon`.
- `Goal` fica pronta para ser reaproveitada por uma futura tela de metas do aluno (fluxo de continuidade, FIT-106-109) sem nenhuma migração adicional — só decisão de produto sobre expor ou não a UI.
- "Fotos privadas" continua listada como restrição obrigatória do pacote (`EPIC-13-FITOS-LIVRE.md`) e como pendência aberta — nenhuma linha deste PR fecha essa lacuna; ela só é destravada quando a decisão de provedor S3 for tomada.
