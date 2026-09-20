# Evidências — FIT-041

Todas as capturas abaixo são reais: Playwright contra o build de produção (`npm run start`), com criação de conta de personal, cadastro de aluno, geração de convite e ativação de conta, cadastro de exercício próprio, criação de um modelo com o dia de hoje marcado, criação de um programa, atribuição ao aluno, início da sessão, preenchimento e salvamento de um resultado, início do temporizador de descanso, retomada da sessão (sem concluir) e conclusão — tudo através da UI e das rotas reais. Nenhum dado inserido diretamente no banco. Todos os usuários (personal e aluno), tenant, exercício, modelo, programa, atribuição e sessão sintéticos foram removidos do banco após a captura.

## "Hoje" mostra "Começar treino" quando há um treino previsto

[Mobile, tema claro](aluno-hoje-comecar-treino-mobile-claro.png): card "Treino de hoje" com o modelo previsto e o botão "Começar treino", que leva à sessão de execução.

## Sessão ainda não iniciada

[Mobile, tema claro](aluno-sessao-pronto-para-comecar-mobile-claro.png): `/painel/treino/sessao` antes de qualquer sessão existir — "Pronto para começar o treino de hoje?" e o botão "Começar treino".

## Execução vazia, recém-iniciada

[Mobile, tema claro](aluno-sessao-execucao-vazia-mobile-claro.png) e [desktop, tema escuro](aluno-sessao-execucao-vazia-desktop-escuro.png): após "Começar treino", o formulário de execução — exercício, músculo, resumo da prescrição, campos de resultado (séries/repetições/duração/carga executadas, independentes dos prescritos), "Repetir prescrito", "Salvar resultado" e o temporizador de descanso.

## Resultado salvo com "Repetir prescrito" e temporizador iniciado

[Mobile, tema claro](aluno-sessao-resultado-salvo-descanso-mobile-claro.png): "Repetir prescrito" preencheu os campos com os valores prescritos (3 séries, 10 repetições, 20kg); após "Salvar resultado", o selo "Salvo" aparece ao lado do botão — o mesmo POST enviado de novo (dupla submissão) apenas substituiria o resultado, nunca duplica (upsert físico por `[workoutSessionId, workoutExerciseId]`).

## "Hoje" muda para "Continuar treino em andamento"

[Mobile, tema claro](aluno-hoje-continuar-treino-mobile-claro.png): o aluno voltou para "Hoje" sem concluir a sessão — o botão do card passa a ser "Continuar treino em andamento", independente do dia da semana.

## Sessão retomada preserva o resultado já salvo

[Mobile, tema claro](aluno-sessao-retomada-resultado-preservado-mobile-claro.png): ao retomar ("continuar"), os campos "3", "10" e "20kg" salvos antes continuam preenchidos — nenhum progresso é perdido ao navegar para fora e voltar.

## Após concluir, "Hoje" volta ao estado sem sessão em andamento

[Desktop, tema escuro](aluno-hoje-apos-concluir-desktop-escuro.png): depois de "Concluir treino", o card volta a mostrar "Começar treino" (uma sessão nova pode ser iniciada; a sessão concluída permanece no histórico, nunca excluída).

## O que não foi fotografado (coberto por teste automatizado real)

- **Prevenção de dupla submissão**: o upsert físico por `[workoutSessionId, workoutExerciseId]` (índice único) é testado em `sessions.integration.test.ts` — reenviar o mesmo item nunca cria uma segunda linha; a UI também desabilita o botão durante o envio (defesa em duas camadas).
- **Abandonar sessão e preservar resultados**: testado em `sessions.integration.test.ts` — os resultados já registrados permanecem após `ABANDONADA`.
- **Falha de conexão com mensagem e nova tentativa**: testado em `ComecarTreinoButton.test.tsx`/`SessaoExecucao.test.tsx` (fetch lançando `TypeError`) — não é reproduzível de forma determinística via Playwright contra um servidor real sem simular queda de rede, e a mensagem exibida é idêntica em ambos os casos (visual e unitário).
- **No máximo uma sessão `EM_ANDAMENTO` por aluno**: índice único parcial testado em `sessions.integration.test.ts` (INSERT direto duplicado rejeitado) e a transição automática (abandonar a sessão de outro treino ao iniciar uma nova) também testada ali.
- **Histórico preserva o treino vigente na execução**: testado em `sessions.integration.test.ts` — reatribuir um novo plano ao aluno depois de uma sessão concluída não altera o `workoutId`/nome já registrados nela.

## Resultado das validações

`npm run test` (479/479 — 16 novos testes de integração em `sessions.integration.test.ts` contra Postgres real; 5 novos testes de rota; 12 novos testes de componente em `SessaoExecucao.test.tsx`/`ComecarTreinoButton.test.tsx`; novo `sessao/page.test.tsx` com 6 casos; `page.test.tsx`/`AlunoHome.test.tsx` do `/painel` atualizados) · `npm run lint` · `npm run typecheck` · `npm run build` (rotas `/painel/treino/sessao` e `/api/workout-sessions/**` registradas) · `npm audit` (0 vulnerabilidades) — todos limpos. Migration aditiva `20260920020000_add_workout_session_results` (`WorkoutSession.startedAt`/`endedAt`, `WorkoutSessionResult`, índices únicos `workout_exercises_id_tenantId_key`/`workout_sessions_id_tenantId_key`, e o índice único parcial `workout_sessions_in_progress_per_student_key`) testada em banco vazio (histórico completo do zero) e como atualização do schema atual (`fitos_dev`/`fitos_test`).
