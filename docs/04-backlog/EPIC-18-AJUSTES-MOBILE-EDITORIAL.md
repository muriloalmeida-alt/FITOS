# EPIC-18 — Ajustes mobile editorial (painel, telas e treino em execução)

## Origem

Em 29/09/2026 Murilo enviou cinco pacotes com a instrução "promova as alterações de código para que reflitam 100% do proposto":

| Pacote | Conteúdo | Escopo |
| --- | --- | --- |
| `AjustesPainel.zip` | `referencias/painel-mobile-aprovado.png`, `docs/ORIENTACOES-CLAUDE.md`, assets (WebP de fundo, marca vetorial transparente) | Painel mobile do Personal (`/painel`). |
| `AjustesTelas.zip` | 35 prévias em `prints/`, `manifesto.json`, `ORIENTACOES-CLAUDE.md`, referências aprovadas (login e painel) | Todas as rotas de página de `src/app` (36, sendo `/` só redirecionamento). |
| `AjustesTreinoAluno.zip` | `print-treino.png`, `previa-interativa.html`, orientações | Execução de treino do Aluno (`/painel/treino/sessao`). |
| `AjustesTreinoLivre.zip` | idem, variante FitOS Livre | Execução de treino do Livre (`/painel/meus-treinos/sessao`). |
| `FitOS_Pacote_Visual_Aprovado_Claude_2026-09-28.zip` | pacote visual 2026 (já executado no EPIC-17, FIT-131…137) | Base desktop e assets; continua valendo onde os ajustes acima não dizem outra coisa. |

Os quatro pacotes novos definem uma **linguagem mobile editorial escura**: fundo quase preto com a camada leve `fitos-bg-mobile-suave.webp` (~15 KB), marca clara/laranja sem retângulo de fundo, cabeçalho com marca + avatar (ou "Menu" nas telas públicas) abaixo da área segura, eyebrow laranja + título + apoio, seções integradas ao fundo (linhas com divisor, sem cartões), campos com rótulo persistente e linha, botão primário laranja com texto navy, e barra inferior azul-noturno com quatro ícones semânticos por papel.

Issue de execução: FIT-138.

## Precedência adotada

1. Regras de negócio, autenticação, RBAC, tenancy e contratos de API do `main` — nenhum foi alterado.
2. Ajustes de 29/09 (Painel, Telas, Treino) para o **mobile** (< 840 px, a mesma faixa em que o `AppShell` já usava a barra inferior).
3. Pacote visual 2026 (EPIC-17) para o **desktop** (≥ 840 px), que permanece como estava, salvo o cabeçalho de página (ver "Decisões").

## O que foi implementado

### Fundação (reutilizável, sem CSS duplicado por página)

- **Tema editorial mobile** em `src/shared/design-system/tokens.css` (`@media (max-width: 839px)`): tokens semânticos escuros, `--fitos-color-eyebrow`, `--fitos-color-divider`, primário `#FF7847` com texto navy. Documentado em `docs/03-design/M3-DESIGN-TOKENS.md`.
- **Fundo WebP** em `src/app/globals.css`: pseudo-elemento fixo (sem `background-attachment: fixed`, instável no iOS), degradê CSS simples para contraste, sem blur/filtros/animação. Asset em `public/media/brand/fitos-bg-mobile-suave.webp`.
- **`viewport-fit=cover`** em `src/app/layout.tsx` — sem ele `env(safe-area-inset-*)` vale 0 no iOS.
- **Componentes base** com variante mobile: `Card` (seção aberta com divisor), `TextField`/`SelectField`/`ExerciseAutocomplete` (rótulo persistente + campo em linha, foco/erro explícitos), `Button` (primário laranja; nova variante `danger`), `FormAlert`, `StudentCard`, `AttentionItem`, `EmptyStateAction`, `ErrorRecovery`, `EvolutionMetric`, `WorkoutExerciseCard`, `WorkoutTodayCard` (sem foto no mobile), `PathPhotoCard` (sem foto no mobile), `AchievementCard`.
- **`AppShell`**: cabeçalho mobile com marca (variante `photo`, transparente) e avatar com as iniciais reais da sessão (`src/app/painel/layout.tsx` → `AccountNameProvider`); cabeçalho de página com `eyebrow` + título + subtítulo no topo do conteúdo; barra inferior de 4 posições iguais, ícone sobre rótulo, ativo em laranja com `aria-current="page"`, alvo ≥ 48 × 56 px e `safe-area-inset-bottom`.
- **Menu de conta (avatar)**: no mobile, dá acesso aos destinos reais que não cabem na barra (ver "Navegação por papel") e ao "Sair"; fecha com Esc/toque fora.
- **`PublicMobileHeader`/`PublicMobileFooter`** (`src/shared/ui/PublicMobileChrome.tsx`): marca + "Menu" (links públicos reais) e rodapé "FitOS • Mais movimento, menos trabalho." nas telas públicas/onboarding.
- **Ícones** (`NavIcon`): "alunos" passa a ser um grupo de duas pessoas e "treinos" um halter nivelado, como nas prévias; novo `novo` (+) para o acesso rápido.

### Navegação por papel (mobile)

| Papel | Barra inferior (prévias) | Destinos reais fora da barra (menu do avatar) |
| --- | --- | --- |
| Personal | Início · Alunos · Treinos · Perfil | Exercícios · Financeiro · Assinatura · Configurações ("Em breve") |
| Aluno | Início · Treino · Progresso · Perfil | — |
| FitOS Livre | Início · Treinos · Evolução · Perfil | Assinatura |

O rail desktop continua listando todos os destinos. Nenhum destino real ficou inacessível. "Hoje" passou a "Início" (Aluno e Livre) e "Progresso" do Livre a "Evolução", como nas prévias 24–33.

**Perfil do FitOS Livre agora é real**: `/painel/perfil` passou a atender o papel `INDIVIDUAL` (dados da conta, espaço, perfil de treino do onboarding, resumo real da assinatura e link para `/painel/assinatura`). Antes a rota redirecionava o Livre para `/painel` e o item era omitido; o print 28 exige Perfil na barra do Livre, e o pacote 2026 permitia exibi-lo "quando houver funcionalidade real" — agora há.

### Painel do Personal (AjustesPainel)

`src/app/painel/PersonalHome.tsx`: eyebrow com a data ("Terça, 29 de setembro"), "Bom dia, <primeiro nome>." e "Seu trabalho em movimento."; "Visão geral" com dois indicadores reais em uma linha e divisor fino (alunos ativos em branco, treinos ativos em laranja, sem zero à esquerda); "Acesso rápido" com três ações circulares (Novo aluno em laranja, Alunos, Treinos), área inteira clicável; "Seu dia" com as pendências reais de `getPersonalAttentionItems` (mensalidade vencida → "Ver cobrança", avaliação pendente/atrasada → "Registrar avaliação") em linhas com avatar de iniciais, e estado vazio honesto. Data e saudação passam a usar o fuso `America/Sao_Paulo` (antes, o fuso do servidor — UTC em homologação — trocava a saudação três horas antes). No desktop, a tela-06 do pacote 2026 continua (hero fotográfico + blocos), com os mesmos dados.

### Telas 01–35 (AjustesTelas)

| Nº | Rota | Aplicação |
| --- | --- | --- |
| 01 | `/conheca` | `LandingHeader` com marca clara + "Menu"; hero sem foto no mobile; benefícios em linhas numeradas; seções sem cartões. Conteúdo e links reais preservados. |
| 02 | `/comecar` | Cabeçalho/rodapé públicos; três caminhos reais como linhas abertas (sem foto); convite continua com `ConviteCodeForm`. |
| 03 | `/treino-sozinho` | Eyebrow "FitOS Livre", seções abertas, CTA real. |
| 04 | `/onboarding-personal` | Cabeçalho/rodapé públicos; etapas, validação, rascunho e seleção de plano do catálogo real inalterados. |
| 05 | `/onboarding` | Idem, eyebrow "FitOS Livre". |
| 06 | `/ativar-conta` | Eyebrow "Ativar conta", título "Ative seu acesso"; fluxo por token inalterado. |
| 07 | `/painel/alunos` | Eyebrow/título/apoio; convite, busca e lista como linhas abertas (avatar de iniciais, status real, chevron); filtros e paginação reais. |
| 08 | `/painel/alunos/novo` | "Novo aluno"; campos reais em linha. |
| 09 | `/painel/alunos/[id]` | "Perfil do aluno"; seções (dados, acesso e convite, programa, avaliações) abertas. |
| 10 | `/painel/alunos/[id]/inativar` | Aviso real de consequência; confirmação com a nova variante `danger` (não laranja positivo). |
| 11 | `/painel/alunos/[id]/encerrar-vinculo` | Idem, com motivo opcional real. |
| 12 | `/painel/treinos` | "Modelos de treino"; linhas abertas; aba ativa Modelos/Programas em laranja. |
| 13 | `/painel/treinos/novo` | "Criar modelo". |
| 14 | `/painel/treinos/[id]` | "Detalhe do modelo"; itens e reordenação reais em linhas. |
| 15 | `/painel/treinos/planos` | Título "Programas". |
| 16 | `/painel/treinos/planos/novo` | "Criar programa". |
| 17 | `/painel/treinos/planos/[id]` | "Detalhe do programa". |
| 18 | `/painel/exercicios` | Lista em linhas com miniatura real de 64 px (e "Sem imagem" honesto); filtros em linha. Corrigido overflow horizontal pré-existente de ~60 px em 360 px (`ExerciseThumbnail` com `max-width: 100%`). |
| 19 | `/painel/exercicios/novo` | "Novo exercício". |
| 20 | `/painel/exercicios/[id]` | "Detalhe do exercício". |
| 21 | `/painel/financeiro` | Resumo "controle do seu negócio" sem foto; indicadores sem blocos coloridos (tom só no texto). Separado da assinatura SaaS. |
| 22 | `/painel/assinatura` | Eyebrow/título; plano, status e cartão reais; nada de Pix/wallet. |
| 23 | `/painel/perfil` | "Seu perfil" (Personal), "Sua conta" (Aluno), "Seu perfil" (Livre, novo). |
| 24 | `/painel` (Aluno) | Data + "Bom dia, <nome>." + "Seu treino em movimento."; treino de hoje, ritmo, evolução e vínculo em seções abertas. |
| 25 | `/painel/treino` | "Seu programa". |
| 26 | `/painel/treino/sessao` | Nova tela de execução (ver abaixo). Estados sem sessão mantêm a mensagem real. |
| 27 | `/painel/progresso` | "Sua evolução". |
| 28 | `/painel` (Livre) | Data + saudação; hero sem foto no mobile. |
| 29 | `/painel/meus-treinos` | Linhas abertas. |
| 30 | `/painel/meus-treinos/novo` | "Criar meu treino". |
| 31 | `/painel/meus-treinos/[id]` | "Meu treino". |
| 32 | `/painel/meus-treinos/sessao` | Nova tela de execução, variante Livre. |
| 33 | `/painel/minha-evolucao` | "Minha evolução". |
| 34/35 | `/politica-de-privacidade`, `/termos-de-uso` | Cabeçalho/rodapé públicos; **texto jurídico integral**, sem resumo. |
| — | `/entrar` | Mantinha a referência de login já aprovada; substituída pelo `AjustesLogin` (FIT-139, ver abaixo). |

### Treino em execução (AjustesTreinoAluno/AjustesTreinoLivre)

Novo `src/app/painel/WorkoutRunner.tsx` (substitui `SessaoExecucao`/`SessaoExecucaoIndividual`, que eram cópias um do outro), usado pelas duas rotas com os **mesmos contratos de API** (`resultados`, `concluir`, `abandonar`):

- Modo foco: sem barra inferior; marca + "Sair" (Aluno — a sessão continua em andamento) ou "Encerrar sessão" (Livre — conclui após confirmação).
- **Tempo total da sessão** sempre visível, com iniciar/pausar; persistido neste aparelho (`localStorage`, chave por sessão) ao sair e voltar; sem estado local, parte do `startedAt` real do servidor. Pausar não conclui série.
- **Descanso** separado do tempo total: começa ao concluir uma série (`restSeconds` da prescrição), pode ser pulado, sobrevive a recarregar; vibra ao fim só se o navegador oferecer `navigator.vibrate`.
- Exercício atual, posição (`02 / 06`), prescrição (repetições/segundos, carga prevista ou atual, descanso), série atual com barras de progresso, barra de progresso geral, próximo exercício, "Ver próximo"/"Exercício anterior", "Como executar" (instruções reais).
- **"Concluir série"** grava de verdade `setsCompleted`/`repsCompleted` (ou `durationSecondsCompleted`)/`loadUsed`; "Realizado: … · Alterar" permite registrar repetições/carga realizadas antes de concluir. No Aluno, a prescrição do Personal é somente leitura (o snapshot do plano não muda). No Livre, "Ajustar carga −/+" (passo 2,5, preservando a unidade digitada) e "Editar sequência do treino" → `/painel/meus-treinos/[id]`; o ajuste fica só no resultado da sessão, não altera outros treinos.
- Confirmação antes de concluir/encerrar/sair com ajustes não registrados, e antes de abandonar; `beforeunload` com dados não salvos.
- **Áudio**: "Áudio durante o treino" abre opções para abrir Spotify/Apple Music no app externo. Nenhuma conta é conectada, nada é controlado e não há player próprio (não existe fonte licenciada) — dito na própria tela.
- Estados: vazio (treino sem exercícios), erro (mensagem da API ou falha de conexão, sem avançar a série), retomada (índice, relógio e descanso restaurados; séries já gravadas vêm do servidor).

### Tela de login (AjustesLogin — FIT-139)

`AjustesLogin.zip` chegou depois do FIT-138 (PR #186): `referencias/proposta-login-mobile.svg` (estados padrão e erro) e `docs/ORIENTACOES-CLAUDE.md`. Implementado em `src/app/entrar/`:

- **Foto em tela cheia** (`scene-solo.png`, `cover`) com degradê CSS da proposta — topo leve preservando a pessoa, base quase sólida sob os campos. Vale em **todas as larguras**: no desktop a foto continua em tela cheia, o degradê escurece a esquerda e o formulário fica nessa região (máx. 400 px). O split 50/50 com cartão e o `AuthHero` saíram desta rota (o componente segue nas demais).
- **Sem cartão** e **sem o título "Entrar" / descrição** acima dos campos; "Entrar" fica só no botão. Um `h1` "Entrar no FitOS" existe apenas para leitores de tela.
- **Marca oficial** (`BrandLogo background="photo"`) no topo, `size=56` (antes 20 no `AuthHero`): o wordmark fica com ~25 px de altura de maiúscula, a mesma da proposta; proporção do vetor preservada. Leva a `/conheca`.
- Frase "Movimento começa / com um plano." mantida sobre a foto.
- Campos em linha com rótulo persistente (também no desktop), placeholder `seu@email.com`, `autocomplete="username"`/`current-password`, foco com linha laranja de 2 px. Botão primário na largura do formulário, alvo de 52 px.
- **Erro de credenciais** junto aos campos, sem caixa: indicador "!" salmão + "E-mail ou senha inválidos." em branco + "Confira os dados e tente novamente.", `role="alert"`. O espaço é reservado (40 px), então o botão não se move ao aparecer o erro. O e-mail digitado permanece.
- `min-height: 100dvh` (fallback `100vh`), `safe-area-inset-*` nas quatro bordas, sem altura fixa: em alturas pequenas a página rola.
- Os tokens semânticos são redefinidos só dentro da página (`.main`), para `TextField`/`Button` ficarem claros sobre a foto também no desktop — nenhum componente compartilhado mudou.

Decisões:

1. **"Esqueceu a senha?" não aparece**: não existe fluxo de recuperação de senha no projeto (a orientação manda não criar navegação falsa).
2. **Botão**: laranja oficial `#FF7847` com texto navy, como no tema mobile do FIT-138, em vez do degradê `#ED4B0C → #BF2D00` com texto branco da proposta. O branco sobre `#ED4B0C` dá ~4,3:1 (abaixo do AA de 4,5:1 para texto de 16 px); o navy sobre `#FF7847` dá ~6,6:1.
3. **Alternância de visibilidade da senha**: não havia no projeto e não foi criada.

Evidências: `docs/06-engenharia/evidencias/FIT-139/`.

**FIT-140 — primeira dobra (29/09/2026)**: a pedido de Murilo ("os campos de login precisam ficar na primeira dobra"), com proposta aprovada antes do desenvolvimento. No mobile (< 840 px) o bloco de acesso deixa de encostar no pé da tela e sobe logo abaixo da marca (`justify-content: flex-start`, respiro `clamp(16px, 7dvh, 72px)`), com espaçamentos menores e "Criar conta" na mesma linha da pergunta. O degradê passa a escurecer a partir de ~34% da altura, para os campos manterem contraste na parte mais alta da foto. Tudo (marca, frase, campos, botão e "Criar conta") cabe em 375 × 553 visíveis (iPhone SE com as barras do Safari). Desktop e tablet sem mudança. Evidências: `docs/06-engenharia/evidencias/FIT-140/`.

## Lacunas documentadas (sem alteração de contrato nesta rodada)

1. **Histórico por série**: o contrato atual (`WorkoutSessionResult`) guarda um agregado por exercício (séries concluídas, repetições, carga). A tela registra cada série incrementando esse agregado; um histórico linha-a-linha por série exige nova tabela/rota.
2. **Relógio entre aparelhos**: pausa/retomada ficam no aparelho (`localStorage`). Sincronizar pausa entre aparelhos exige persistir intervalos de pausa no servidor.
3. **Player próprio do FitOS**: sem fonte de áudio licenciada, só há o atalho para apps externos.
4. **Notificação ao fim do descanso**: só vibração quando disponível; notificação push exigiria permissão e service worker.
5. **Desktop**: os ajustes de 29/09 são mobile; o desktop continua o pacote 2026. Mudança visível no desktop: o título da página saiu da barra superior para o topo do conteúdo (com eyebrow/subtítulo), como o contrato desktop já previa ("título ~132 px, no conteúdo"); no Início do Personal o cabeçalho de página fica só para leitores de tela no desktop, porque o hero já mostra a saudação.
6. **Validação em homologação**: as evidências abaixo são locais (PostgreSQL local, `next dev`, dados sintéticos). Falta validar em Railway com contas reais dos três papéis, em iOS com ilha e Android com status bar reais, e o aceite de Produto.

## Validação local

- `npm run lint`, `npm run typecheck`, `npm test` (199 arquivos, 1.215 testes) e `npm run build`: verdes.
- Testes novos/atualizados: `WorkoutRunner.test.tsx` (13 casos: prescrição, gravação da série, avanço, descanso, erro, pausa persistida, retomada, áudio, confirmações, Livre), `AppShell.test.tsx` (barra por papel, menu do avatar, eyebrow), `PersonalHome.test.tsx` (acesso rápido, "Seu dia" vazio/populado, data), `perfil/page.test.tsx` (Perfil do Livre).
- Sem overflow horizontal (verificação automática por `scrollWidth`) em 320 px nas rotas públicas e em 360 px em todas as rotas autenticadas dos três papéis; zoom 150% sem corte no Início do Personal; foco visível por teclado.
- Evidências: `docs/06-engenharia/evidencias/FIT-138/`.

## Aceite

Só conclui com validação visual em homologação (três papéis, 360/390/430/768 e desktop) e aceite explícito de Murilo — nunca apenas por testes ou diff.
