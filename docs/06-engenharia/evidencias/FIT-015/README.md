# Evidências — FIT-015

Todas as capturas abaixo são reais: Playwright contra o build de produção (`npm run start`), com cadastro/login/cadastro de aluno/geração de convite/ativação todos feitos através da UI e da rota pública reais — nenhum dado inserido diretamente no banco, nenhum token fabricado. Personal, os 2 alunos sintéticos e o aluno já ativado foram removidos do banco após a captura. Os tokens que aparecem nas capturas já estavam invalidados (usados ou cancelados) no momento da captura e foram descartados imediatamente depois.

## Gerar convite

[Perfil do aluno após clicar em "Gerar convite"](perfil-convite-gerado.png): link exibido para cópia, com "Convite pendente — expira em 7 dia(s)".

## Página pública de ativação (token real, válido)

[Formulário de definição de senha](ativar-conta-formulario.png): "Olá, Aluno Convite" — nome do aluno exibido porque o token é válido e é dele (não é o mesmo caso de token inválido, tratado abaixo).

## Aluno autenticado após ativar a própria conta

[`/painel` do aluno, imediatamente após ativar](aluno-painel-apos-ativacao.png): "Papel: Aluno" — a sessão já existe (cookie real repassado pela rota de ativação), sem precisar fazer login separadamente.

## Replay do mesmo link — rejeitado, sem revelar dados

[Reabrindo o mesmo link já usado](ativar-conta-link-ja-usado.png): "Este link não é válido ou já expirou." — mensagem genérica, idêntica à de um token inexistente ou expirado; nenhum nome de aluno é revelado.

## Perfil do personal — conta ativa

[Perfil do aluno depois de ativar](perfil-conta-ativa.png): "Acesso: Conta ativa"; e-mail bloqueado com a explicação ("Este aluno já ativou a conta...").

## Cancelar convite

[Perfil de um segundo aluno, convite gerado e depois cancelado](perfil-convite-cancelado.png): "Acesso: Convite cancelado", com o botão "Gerar convite" disponível de novo (não "Gerar novo convite" — não há convite pendente para renovar).

## Resultado das validações

`npm ci` (instalação limpa) · `npx prisma generate` · `npm run lint` · `npm run typecheck` · `npm run test` (192/192 — 46 novos: 12 de `invitations.integration.test.ts`, 13 de `activation.integration.test.ts` — incluindo o teste de concorrência real com `Promise.allSettled` —, e o restante em rotas/páginas/componentes) · `npm run build` (rotas `/api/students/[id]/convite`, `/api/ativar-conta`, `/ativar-conta` registradas) · `npm audit` (0 vulnerabilidades) — todos limpos.
