# Evidências — FIT-014

Todas as capturas abaixo são reais: Playwright contra o build de produção (`npm run start`), com cadastro/login/cadastro de aluno reais através da UI (nenhum dado inserido diretamente no banco). Usuário personal e o aluno sintético foram removidos do banco após a captura.

## Perfil do aluno

[Perfil de um aluno ativo, ainda sem conta ativada](perfil-aluno.png): status "Ativo", nome e e-mail editáveis, botão "Inativar aluno".

## Edição de nome — sucesso

[Após salvar um novo nome](perfil-editado-sucesso.png): "Alterações salvas." — confirmação real do servidor, não apenas do formulário.

## Confirmação explícita de inativação

[Página dedicada de confirmação](confirmar-inativacao.png): explica o impacto ("some da lista padrão... histórico é preservado... pode reativar a qualquer momento") antes do clique em "Confirmar inativação" — nunca um "Tem certeza?" genérico.

## Perfil após inativar

[Status muda para "Inativo"](perfil-apos-inativar.png), e o botão de ciclo de vida passa a ser "Reativar aluno".

## Lista padrão não mostra o aluno inativado

[Lista padrão (filtro "Ativos") depois de inativar o único aluno da carteira](lista-sem-aluno-inativo.png): "Todos os seus alunos estão inativos. Selecione 'Todos' ou 'Inativos' para vê-los." — mensagem distinta de "Nenhum aluno cadastrado ainda.", para não sugerir que a carteira está vazia quando não está.

## Filtro "Inativos" mostra o aluno

[Selecionando o filtro "Inativos"](lista-filtro-inativos.png): o aluno aparece normalmente, com o rótulo "Inativo".

## Perfil após reativar

[Status volta para "Ativo"](perfil-apos-reativar.png) depois de clicar em "Reativar aluno" no perfil.

## Resultado das validações

`npm run lint`, `npm run typecheck`, `npm run test` (146/146 — 35 novos: 13 de `students.integration.test.ts`, 2 de `authContext.integration.test.ts`, 9 de rotas, 11 de páginas/componentes), `npm run build` (rotas `/api/students/[id]`, `/api/students/[id]/inativar`, `/api/students/[id]/reativar`, `/painel/alunos/[id]`, `/painel/alunos/[id]/inativar` registradas) e `npm audit` (0 vulnerabilidades) — todos limpos.
