# Evidências — FIT-033

Todas as capturas abaixo são reais: Playwright contra o build de produção (`npm run start`), com criação de conta de personal, cadastro de aluno, geração de convite e ativação de conta (mesma trilha da FIT-015/016), cadastro de exercícios próprios, criação de dois modelos de treino com itens, criação de um programa, atribuição do programa ao aluno, edição do modelo original depois de atribuído, e encerramento da atribuição — todos feitos através da UI e das rotas reais. Nenhum dado inserido diretamente no banco. Todos os usuários (personal e aluno), tenant, exercícios, modelos, programa e atribuições sintéticos foram removidos do banco após a captura (incluindo o desligamento temporário dos dois TRIGGERs de imutabilidade de snapshot, necessário só para a limpeza — nunca para a atribuição real).

## Aluno sem programa atribuído (estado honesto, antes de qualquer atribuição)

[Mobile, tema claro](aluno-sem-plano-mobile-claro.png): "Você ainda não tem um programa de treino atribuído. Fale com seu personal." — item "Treino" da navegação do aluno deixa de ser "Em breve".

## Personal, ficha do aluno, antes de atribuir

[Mobile, tema claro](personal-aluno-sem-programa-mobile-claro.png): card "Programa de treino" com "Nenhum programa atribuído ainda." e o seletor "Atribuir programa".

## Personal atribui o programa ao aluno

[Desktop, tema escuro](personal-programa-atribuido-desktop-escuro.png): após selecionar "Programa A" e confirmar, o card mostra o nome do programa, "Atribuído em 20/09/2026", o botão "Encerrar atribuição" e a seção "Trocar programa" para uma futura reatribuição.

## Aluno visualiza o programa atribuído, somente leitura

[Mobile, tema claro](aluno-plano-ativo-mobile-claro.png) e [desktop, tema escuro](aluno-plano-ativo-desktop-escuro.png): "Programa A", vigência sugerida "4 semanas", os dois modelos ("Treino A"/"Treino B") com seus exercícios, músculo, séries/repetições/carga/descanso e observação — nenhum botão de edição, puramente leitura.

## Prova de imutabilidade: editar o modelo original não altera o que foi atribuído

Entre a captura anterior e esta, o personal renomeou o modelo original "Treino A" para "Treino A EDITADO" pela UI real (`/painel/treinos/[id]`, "Salvar alterações"). [Mobile, tema claro](aluno-plano-imutavel-apos-edicao-mobile-claro.png): a visão do aluno continua mostrando "Treino A" — idêntica, byte a byte, à captura anterior — porque a atribuição aponta para a cópia física (`TrainingPlan.isSnapshot: true`, ADR-005) criada no momento da atribuição, nunca para o modelo editável do personal.

## Personal encerra a atribuição, sem substituir

[Desktop, tema escuro](personal-atribuicao-encerrada-desktop-escuro.png): após "Encerrar atribuição", o card volta a "Nenhum programa ativo atualmente." — a seção "Atribuir programa" permanece disponível para uma nova atribuição.

## Aluno visualiza o estado "programa encerrado"

[Mobile, tema claro](aluno-plano-encerrado-mobile-claro.png): 'Seu programa "Programa A" foi encerrado. Fale com seu personal para receber um novo.' — mensagem distinta da de "nunca atribuído" (primeira captura), confirmando os três estados exigidos: sem plano, plano ativo e plano encerrado.

## Resultado das validações

`npm run test` (415/415 — 11 novos testes de integração em `workouts.integration.test.ts` contra Postgres real cobrindo criação do snapshot, imutabilidade após edição do original, isolamento entre tenants, encerramento automático ao reatribuir, e a unicidade física da atribuição ativa; 7 novos testes de rota em `api/students/[id]/plano/route.test.ts`; `alunos/[id]/page.test.tsx` estendido com 3 novos casos para os três estados do programa; novo `painel/treino/page.test.tsx` com 5 casos) · `npm run lint` · `npm run typecheck` · `npm run build` (rota `/painel/treino` e `/api/students/[id]/plano` registradas) · `npm audit` (0 vulnerabilidades) — todos limpos. Migration aditiva `20260920010000_add_plan_assignment_lifecycle` (`PlanAssignment.endedAt` + índice único parcial `plan_assignments_active_per_student_key` em `(studentId, tenantId) WHERE active = true`) testada em banco vazio (histórico completo do zero) e como atualização do schema atual (`fitos_dev`/`fitos_test`).
