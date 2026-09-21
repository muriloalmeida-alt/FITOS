# Evidências — FIT-040

Todas as capturas abaixo são reais: Playwright contra o build de produção (`npm run start`), com criação de conta de personal, cadastro de dois alunos, geração de convite e ativação de conta (mesma trilha da FIT-015/016), cadastro de exercícios próprios, criação de modelos com dias sugeridos reais (marcados via checkbox na UI, `EditarModeloForm`), criação de programas, atribuição e encerramento — tudo através da UI e das rotas reais, sem nenhum dado inserido diretamente no banco. Todos os usuários (personal e alunos), tenant, exercícios, modelos, programas e atribuições sintéticos foram removidos do banco após a captura.

Os dias sugeridos usados na captura foram calculados a partir do dia da semana real do momento da execução (hoje = `DOMINGO`; outro dia usado para o estado "descanso" = `SEGUNDA`) — a mesma lógica exata de `getTodayScheduleForStudent`.

## Estado "sem plano" (nunca atribuído)

[Mobile, tema claro](aluno-hoje-sem-plano-mobile-claro.png): card "Treino de hoje" com "Você ainda não tem um programa de treino atribuído. Fale com seu personal." — a mesma tela "Hoje" que, desde a FIT-016, só mostrava o vínculo.

## Estado "treino previsto para hoje"

[Mobile, tema claro](aluno-hoje-treino-do-dia-mobile-claro.png) e [desktop, tema escuro](aluno-hoje-treino-do-dia-desktop-escuro.png): o modelo com o dia de hoje configurado aparece com nome, exercício, músculo e resumo de prescrição ("3 séries · 10 repetições") — derivado da atribuição ativa real (FIT-033), nunca do plano editável do personal.

## Estado "descanso" (plano ativo, nenhum modelo previsto para hoje)

[Mobile, tema claro](aluno-hoje-descanso-mobile-claro.png) e [desktop, tema escuro](aluno-hoje-descanso-desktop-escuro.png): "Hoje é dia de descanso. Nenhum treino previsto para hoje." — aluno com atribuição ativa, mas cujo único modelo tem o dia sugerido marcado para outro dia da semana (`SEGUNDA`, não hoje).

## Estado "plano encerrado"

[Mobile, tema claro](aluno-hoje-plano-encerrado-mobile-claro.png): 'Seu programa "Programa Hoje ..." foi encerrado. Fale com seu personal para receber um novo.' — após o personal clicar "Encerrar atribuição" (mesma ação da FIT-033), a tela "Hoje" reflete o encerramento imediatamente, distinto do estado "nunca atribuído".

## Resultado das validações

`npm run test` (426/426 — 6 novos testes de integração em `workouts.integration.test.ts` contra Postgres real cobrindo os quatro estados e isolamento; novo `AlunoHome.test.tsx` com 5 casos; `page.test.tsx` atualizado) · `npm run lint` · `npm run typecheck` · `npm run build` (nenhuma rota nova — `/painel` já existia desde a FIT-012/016) · `npm audit` (0 vulnerabilidades) — todos limpos. Nenhuma migration nesta História (reaproveita integralmente o schema de `Workout.suggestedDays`, já existente desde a FIT-030, e a atribuição ativa da FIT-033).
