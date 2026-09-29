# Evidências — FIT-138 (EPIC-18, ajustes mobile editorial)

Capturas reais com Playwright (Chromium) contra `next dev` local, PostgreSQL 16 local com migrations aplicadas, catálogo curado importado e contas criadas pelas rotas reais (`/api/auth/sign-up/email`, onboarding, cadastro de aluno, convite e ativação, criação de treinos/programa e atribuição). Nenhum dado de produção. Os nomes de alunos usados no ambiente local (ex.: "Ana Costa") foram digitados como dados de teste — não existem no código; a aplicação só exibe o que está no banco.

Viewport 390 × 844 (mobile), salvo indicação. Sem área segura real (browser desktop): o respiro superior mínimo de 40 px aparece; o `env(safe-area-inset-*)` precisa ser conferido em iPhone/Android reais na homologação.

| Arquivo | Conteúdo |
| --- | --- |
| `01-publicas-onboarding.jpg` | 01 `/conheca`, 02 `/comecar`, 03 `/treino-sozinho`, `/comecar?modo=personal`, 06 `/ativar-conta` (token ausente), 34, 35, `/entrar` (referência aprovada mantida), 04 `/onboarding-personal`, 05 `/onboarding`. |
| `02-personal-alunos.jpg` | `/painel` populado e **vazio** (conta sem alunos), 07 `/painel/alunos` populado e vazio, 08, 09, 10 (confirmação `danger`), 11. |
| `03-personal-treinos-exercicios.jpg` | 12–20. |
| `04-personal-financeiro-assinatura-perfil.jpg` | 21, 22, 23 e o menu de conta do avatar (Exercícios, Financeiro, Assinatura, Configurações "Em breve", Sair). |
| `05-aluno.jpg` | 24 (com sessão em andamento), 25, 26 (execução), 27, Perfil. |
| `06-livre.jpg` | 28–33, Perfil do Livre (novo), Assinatura. |
| `07-sessao-vs-referencia.jpg` | Execução Aluno × `print-treino.png` do pacote; execução Livre × referência; Livre após "Concluir série" (descanso contando, série 2 de 3, carga ajustada) e com o módulo de áudio aberto. |
| `08-painel-vs-referencia.jpg` | `/painel` do Personal × `painel-mobile-aprovado.png`, e o estado vazio de "Seu dia". |
| `09-larguras-e-acessibilidade.jpg` | `/painel` em 320, 360, 430 e 768 px; zoom 150%; foco por teclado; menu público aberto. |
| `10-desktop-regressao.jpg` | 1440 × 900: `/painel` e `/painel/alunos` (rail completo, título no conteúdo) e a execução do treino no desktop. |
