# Evidências — FIT-016

Todas as capturas abaixo são reais: Playwright contra o build de produção (`npm run start`), com criação de conta de personal, cadastro de aluno, geração de convite e ativação de conta todos feitos através da UI e das rotas reais (a mesma trilha já validada na FIT-013/014/015) — nenhum dado inserido diretamente no banco, exceto o estado "sem vínculo" (ver nota abaixo). Todos os usuários, alunos, convites e tenants sintéticos foram removidos do banco após a captura.

## Aluno ativo e vinculado — "Hoje"

[Mobile, tema claro](aluno-hoje-mobile-claro.png): "Olá, Aluno Ativo" — card "Seu vínculo" com Personal, Espaço e Estado da conta, todos derivados da sessão no servidor (nunca de algo que o cliente poderia influenciar).

[Desktop, tema escuro](aluno-hoje-desktop-escuro.png): mesmo conteúdo, navegação lateral com "Perfil" já como destino real (sem "Em breve").

## Aluno ativo — página "Sua conta" (perfil)

[Mobile, tema claro](aluno-perfil-mobile-claro.png) e [desktop, tema escuro](aluno-perfil-desktop-escuro.png): nome e e-mail da própria conta, acessível a partir do item "Perfil" da navegação do aluno.

## Aluno com vínculo inativado

[Mobile, tema claro](aluno-inativo-mobile-claro.png): "Conta inativa" — "Sua conta foi inativada pelo seu personal. Fale com ele para reativar o acesso." Mensagem distinta da de "sem vínculo" abaixo — o aluno já teve acesso; o personal pausou o vínculo (fluxo real da FIT-014, aplicado nesta captura através do botão "Inativar aluno"/"Confirmar inativação").

## Aluno sem nenhum vínculo

[Mobile, tema claro](aluno-sem-vinculo-mobile-claro.png): "Sem vínculo ativo" — "Sua conta ainda não está vinculada a um personal." Estado residual (não há fluxo de produto que o produza — o cadastro público é exclusivo de personal, e um aluno normal só existe a partir de um convite); reproduzido aqui promovendo manualmente uma conta ALUNO sem `Student` associado, apenas para a captura de evidência da mensagem correta. Nenhum aluno real do produto passa por esse caminho.

## Personal não assume a identidade de aluno alterando a URL

[Personal autenticado tentando acessar `/painel/perfil` diretamente](personal-tentativa-perfil-aluno.png): redirecionado de volta para `/painel` (o próprio shell de personal) — a URL da conta do aluno não expõe nada a quem não é um aluno com vínculo ativo; a mesma checagem de servidor (`requireStudent`) que protege as rotas de API protege esta página.

## Resultado das validações

`npm ci` (instalação limpa) · `npx prisma generate` · `npm run lint` · `npm run typecheck` · `npm run test` (196/196 — `page.test.tsx` atualizado para o novo shape de `AlunoHome`/`page.tsx` com um caso novo para o estado "inativo", e um novo `perfil/page.test.tsx` com 3 casos, incluindo o caso de um personal sendo rejeitado por `requireStudent`) · `npm run build` (rota `/painel/perfil` registrada) · `npm audit` (0 vulnerabilidades) — todos limpos. Não houve nenhuma migration nesta História (nenhuma mudança de schema).
