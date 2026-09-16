# Evidências — FIT-013

Todas as capturas abaixo são reais: Playwright contra o build de produção (`npm run start`), com cadastro/login reais e cadastro de aluno feito através do formulário real (não inserido diretamente no banco). Usuário personal e os 3 alunos sintéticos foram removidos do banco após a captura.

## Lista vazia

[Sem nenhum aluno cadastrado](alunos-lista-vazia.png): "Nenhum aluno cadastrado ainda." — estado real, não texto fixo (some assim que há resultado).

## Formulário de cadastro

[Formulário vazio](alunos-cadastro-formulario.png): campos "Nome completo" e "E-mail".

## Lista com alunos — mobile e desktop

[Mobile](alunos-lista-mobile.png) e [desktop](alunos-lista-desktop.png): 3 alunos cadastrados via formulário real, todos `Ativo`, ordenados por nome (Ana, Carlos, Fulano). No desktop, a navegação usa a rail lateral (FIT-012); no mobile, a barra inferior — o item "Alunos" está com `href` real e ativo, os demais continuam "Em breve".

## Erro de validação — e-mail duplicado

[Tentativa de cadastrar o mesmo e-mail duas vezes no mesmo tenant](alunos-cadastro-erro-duplicado.png): "Já existe um aluno com este e-mail na sua carteira." — mensagem devolvida pelo servidor (`StudentError`), não uma validação apenas de formato.

## Busca sem resultado

[Busca por um termo que não corresponde a nenhum aluno](alunos-busca-sem-resultado.png): "Nenhum resultado para essa busca." — mensagem diferente da lista vazia, porque há alunos cadastrados, apenas nenhum corresponde ao filtro.

## Resultado das validações

`npm run lint`, `npm run typecheck`, `npm run test` (111/111 — 27 novos: 10 de `students.integration.test.ts`, 8 de `route.test.ts`, 6 de `page.test.tsx`, 3 de `CadastrarAlunoForm.test.tsx`), `npm run build` (todas as rotas registradas, incluindo `/api/students`, `/painel/alunos` e `/painel/alunos/novo`) e `npm audit` (0 vulnerabilidades) — todos limpos.
