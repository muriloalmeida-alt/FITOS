# FitOS — Product Backlog dos Épicos 19 a 23 (protótipo de ação, outubro/2026)

> **Status: proposta para aprovação.** Nenhuma História foi iniciada. Nenhuma Issue foi aberta.

## Origem

Em 04/10/2026 Murilo aprovou o protótipo navegável "FitOS — Protótipo EPIC-19" (29 telas em 5 páginas, artefato privado no claude.ai) e pediu:

1. Uma História por tela (29), separadas pelos 5 grandes épicos do protótipo.
2. Toda funcionalidade do protótipo que não existe no backend deve ser desenvolvida.

Decisões já tomadas por Murilo:

- **Duas fases.** O **Momento 1** (EPIC-19 a EPIC-23) entrega as 29 telas. O **Momento 2** traz dois épicos de evolução, decididos em 04/10/2026 (ver "Momento 2" no fim deste documento):
  - **EPIC-24 · Comunicação com o aluno por e-mail e push.** Toda comunicação com o aluno fica para essa evolução.
  - **EPIC-25 · Revisão do módulo de construção de treinos.** A evolução clara dos treinos fica para esse épico.
- **Tema:** escuro, liso, **sem imagem de fundo** (remove `fitos-bg-mobile-suave.webp` do EPIC-18). Sempre cor escura e lisa.
- **Preços:** mantêm os valores atuais de `planCatalog.ts`: Personal 20 R$ 49,90; Personal 50 R$ 69,90; Personal Ilimitado R$ 99,90; FitOS Livre R$ 19,90. Todos com 30 dias grátis.
- **Prescrição padrão** de exercício adicionado pela biblioteca: 3 séries × 12 repetições, 60 s de descanso, carga livre.

## Princípio de produto

**Ação primeiro, formulário só quando inevitável.**

- Escolher em vez de digitar: chips, cartões e botões no lugar de `select`.
- Valores sugeridos já preenchidos: prescrição padrão, última avaliação, valor da recorrência.
- `+` e `−` no lugar de campos numéricos.
- Edição em *sheet* curta sobre a própria tela, sem navegar para uma página só de formulário.
- Salvamento automático onde não houver risco.
- Cada linha de lista termina numa ação.

## Os 5 épicos

| Épico | Tema | Histórias | Telas do protótipo |
|---|---|---|---|
| **EPIC-19** | Personal: gestão a partir da ação | FIT-143 a FIT-150 (8) | P1 a P8 |
| **EPIC-20** | Aluno com personal | FIT-151 a FIT-155 (5) | A1 a A5 |
| **EPIC-21** | FitOS Livre | FIT-156 a FIT-161 (6) | L1 a L6 |
| **EPIC-22** | Entrada, cadastro e onboarding | FIT-162 a FIT-170 (9) | E1 a E9 |
| **EPIC-23** | Fundação visual e estados do sistema | FIT-171 (1) | S1 |

Total: **29 Histórias**, uma por tela. Este é o **Momento 1**.

**Momento 2** (registrado, ainda não detalhado em Histórias):

| Épico | Tema |
|---|---|
| **EPIC-24** | Comunicação com o aluno por e-mail e push |
| **EPIC-25** | Revisão do módulo de construção de treinos |

---

## Funcionalidades que não existem no backend (a desenvolver)

Levantamento feito contra o `main` em 04/10/2026 (`prisma/schema.prisma`, `src/modules/**`, `src/app/api/**`). Cada item fica dentro da História que o usa; nenhum vira tela própria.

| Código | Funcionalidade nova | Situação hoje | Histórias |
|---|---|---|---|
| **BK-01** | Adicionar vários exercícios de uma vez a um treino, com a prescrição padrão | `addWorkoutExercise` adiciona um por vez e exige a prescrição | FIT-146, FIT-157 |
| **BK-03** | Atribuir um programa a vários alunos de uma vez | `assignTrainingPlanToStudent` atende um aluno por chamada | FIT-146 |
| **BK-05** | Feed "Acontecendo agora" do Personal: treino concluído, sem programa, convite aceito, programa terminando, avaliação pendente, cobrança atrasada | Só existe `getPersonalAttentionItems` (cobrança e avaliação) | FIT-143 |
| **BK-06** | Indicadores: % de treinos concluídos na semana (espaço inteiro) e aderência semanal por aluno | `getWeeklyRhythmForStudent` existe por aluno; agregado do espaço e lista com aderência não existem | FIT-143, FIT-144 |
| **BK-07** | Filtros de alunos "Precisam de você" e "Convites" (pendente ou expirado), com contagem | `listStudents` filtra só por status do aluno | FIT-144 |
| **BK-08** | "Criar uma versão minha" de um exercício da biblioteca global | Não existe | FIT-147 |
| **BK-09** | Gerar de uma vez todas as cobranças recorrentes do mês | `generateNextChargeForRecurrence` gera uma por vez | FIT-148 |
| **BK-10** | Cobrança com "Repetir todo mês" (cobrança e recorrência numa transação só) | Duas operações separadas | FIT-148 |
| **BK-11** | Registro **por série** na execução (carga e repetições de cada série) | `WorkoutSessionResult` guarda um agregado por exercício (`@@unique([workoutSessionId, workoutExerciseId])`). Nova tabela por série, mantendo o agregado para compatibilidade (ver Decisão técnica 2) | FIT-153, FIT-158 |
| **BK-12** | "Última vez" por exercício e recordes calculados por série | `listPersonalRecordsForStudent` usa o agregado | FIT-153, FIT-158, FIT-154, FIT-159 |
| **BK-13** | Esforço percebido (1 a 5) no fim do treino, visível ao personal | Não existe campo | FIT-153, FIT-158, FIT-145 |
| **BK-14** | Tempo ativo da sessão, descontando pausas | Só `startedAt` e `endedAt` | FIT-153, FIT-158 |
| **BK-15** | Player de música integrado ao Spotify: entrar, playlists, tocar, pausar, próxima | Hoje só há links para apps externos | FIT-153, FIT-158 |
| **BK-16** | Dias sugeridos nos treinos do FitOS Livre e "Hoje para você" | A rota `meus-treinos/[id]` ignora `suggestedDays` de propósito | FIT-156, FIT-157 |
| **BK-18** | Assinar de novo depois de cancelar | Validar e ajustar `subscribeTenantToPlan` com assinatura `CANCELADA` | FIT-150, FIT-161 |

Itens levantados que passaram para o **Momento 2**:

- **BK-02** (programa por dia da semana) e **BK-04** (atribuir treino solto com programa automático) → EPIC-25.
- **BK-17** (e-mail transacional) → EPIC-24.

Os códigos foram mantidos para rastreabilidade.

Funcionalidades novas **só de frontend**, sem backend:

- Tela sempre ligada (Wake Lock).
- Voz (`speechSynthesis`), bipes (Web Audio) e vibração.
- Cronômetro do exercício por tempo e descanso com contagem.
- Trocar a ordem ou pular exercício durante o treino.
- Imagem do resultado gerada no aparelho e compartilhada (Web Share).
- Compartilhar o link do convite.
- Mostrar/ocultar senha.
- Plano sugerido pela faixa de alunos.

### Decisão técnica proposta (para validar no PR da FIT-153)

1. **Registro por série (BK-11):** nova tabela `workout_set_results` (sessão, item do treino, número da série, carga, repetições ou segundos, horário). O agregado `WorkoutSessionResult` continua sendo atualizado, para não quebrar histórico, recordes e telas antigas. Vira ADR-011.

---

## EPIC-23 — Fundação visual e estados do sistema

Vem primeiro: todas as outras Histórias usam estes componentes.

### FIT-171 — S1 · Fundação do tema escuro liso e estados do sistema (`P0`)

**Como** qualquer usuário, **quero** telas consistentes, legíveis e com retorno claro quando algo carrega, falha ou não é permitido, **para** confiar no app.

Critérios de aceite:
- Tema escuro liso em todas as larguras: fundo `#07090D`, **sem** a imagem `fitos-bg-mobile-suave.webp` (removida de `globals.css` e de `public/`). Tokens em `tokens.css` e documentação em `M3-DESIGN-TOKENS.md`.
- Componentes novos em `src/shared/ui`, com testes:
  - `Sheet` (modal inferior com foco preso e Esc para fechar).
  - `Stepper` (−/+, alvo ≥ 44 px, variante grande de 60 a 64 px).
  - `ChipGroup` (seleção única ou múltipla, acessível como `radiogroup` ou `group`).
  - `SegmentedTabs`, `Toast` (com `role="status"`), `NextStepCard`, `ActionRow` (linha com ação).
  - `Switch`, `Skeleton`, `ProgressBar`, `WeekStrip`.
- `BottomNav` com 4 destinos por papel, mantendo a navegação do EPIC-18. O avatar leva ao Perfil.
- Estados padronizados, com componente e rota:
  - Carregamento com esqueleto do formato da tela (`loading.tsx`), nunca um spinner solto.
  - Erro de conexão com "Tentar de novo" (`error.tsx`).
  - Erro de campo junto do campo, com foco no primeiro inválido.
  - Sem permissão, mostrando o papel atual e um botão para o próprio Início.
  - Não encontrado (`not-found.tsx`).
  - Limite do plano, com "Ver planos" e "Gerenciar alunos".
- Desktop (≥ 840 px) usa os mesmos componentes no layout de rail atual. Validado em 360, 390, 768, 1024 e 1440 px.
- Contraste AA e alvos ≥ 44 px verificados.

Backend novo: nenhum.

---

## EPIC-19 — Personal: gestão a partir da ação

### FIT-143 — P1 · Início do Personal com feed de ações (`P0`)

**Como** personal, **quero** abrir o app e ver o que precisa de mim hoje, com a ação a um toque, **para** não procurar nada em menus.

Critérios de aceite:
- Saudação com data (fuso `America/Sao_Paulo`, como hoje).
- Faixa do teste grátis ou da assinatura, que leva a Assinatura.
- Indicadores:
  - Alunos ativos de X do plano.
  - % dos treinos da semana concluídos (BK-06).
  - Recebido no mês e número de cobranças atrasadas (`getFinancialSummary`), levando ao Financeiro.
- Feed "Acontecendo agora" (BK-05), em que cada linha tem **uma** ação:

  | Situação | Ação |
  |---|---|
  | Sem programa | Atribuir programa |
  | Convite aceito | Montar o primeiro treino |
  | Treino concluído (com esforço, BK-13) | Ver evolução |
  | Cobrança atrasada | Registrar pagamento |
  | Avaliação pendente | Registrar avaliação |
  | Programas terminando em 7 dias | Renovar |

- Acesso rápido: Convidar aluno, Montar treino, Nova cobrança.
- Estado vazio para espaço novo, com o primeiro passo.

Backend novo: **BK-05, BK-06.**

### FIT-144 — P2 · Alunos e convite em um passo (`P0`)

**Como** personal, **quero** encontrar alunos e convidar um novo só com nome e e-mail, **para** começar o acompanhamento em segundos.

Critérios de aceite:
- Busca por nome ou e-mail.
- Filtros com contagem: Ativos, Precisam de você, Convites, Inativos (inclui vínculo encerrado), Todos (BK-07).
- Cada linha mostra o status (sem programa, nova, cobrança atrasada, convite pendente ou expirado, inativa, vínculo encerrado) e a aderência da semana (BK-06).
- Paginação por "Carregar mais".
- Novo aluno em *sheet* (nome e e-mail) cria o aluno e o convite.
- A tela de confirmação tem: link do convite, Copiar, Compartilhar (o personal manda por onde quiser; o FitOS não envia mensagem), "Atribuir programa" e Abrir perfil.
- Limite do plano bloqueia com o estado de FIT-171.
- Linha de vagas livres no plano.

Backend novo: **BK-06, BK-07.**

### FIT-145 — P3 · Perfil do aluno com ações no contexto (`P0`)

**Como** personal, **quero** resolver tudo do aluno numa tela, **para** não navegar entre páginas de formulário.

Critérios de aceite:
- Bloco de foco quando falta programa, com "Atribuir programa" (escolha em *sheet*) e "Montar um treino", que abre o editor da FIT-146.
- Com programa ativo, mostra: semana X de Y, faixa da semana, Trocar e Encerrar programa. Ajustar os treinos só deste aluno fica para o EPIC-25 (hoje a cópia atribuída é imutável, ADR-005).
- Treino: ritmo da semana, última sessão e esforço percebido das últimas sessões (BK-13).
- Avaliações em *sheet*:
  - Já começa com os valores da última avaliação.
  - Peso e gordura com +/−, as 6 medidas reais (cintura, quadril, peito, braço, coxa, panturrilha) e observação.
  - Histórico com Excluir.
- Mensalidade do mês com "Recebi", que registra o pagamento direto (Pix, hoje, valor da cobrança), e link para a recorrência.
- Acesso:
  - Estado do convite.
  - Ver ou copiar link, gerar novo e cancelar.
  - Se cancelado, gerar convite.
- Editar dados em *sheet*.
- Inativar e reativar com *sheet* de impacto.
- Encerrar vínculo com motivo em chips e confirmação. O aluno vê o estado "Sem vínculo" ao entrar; o aviso por e-mail ou push fica no EPIC-24.
- Rotas `/inativar` e `/encerrar-vinculo` viram *sheets*; as URLs antigas redirecionam para o perfil.

Backend novo: **BK-13.**

### FIT-146 — P4 · Treinos e programas sem formulário (`P0`, **primeira entrega de valor**)

**Como** personal, **quero** montar um treino pela biblioteca, organizar a semana e atribuir em poucos toques, **para** gastar minutos, não meia hora.

Critérios de aceite:
- Abas Treinos, Programas e Exercícios; chips Ativos e Arquivados com contagem.
- **Novo treino** abre direto o editor:
  - Nome editável no título.
  - Dias com botões de alternar.
  - "Salvo automaticamente".
- **Biblioteca:**
  - Busca, filtro por músculo e seleção de vários exercícios.
  - "Adicionar N" usa a prescrição padrão 3 × 12, 60 s (BK-01).
  - Marca o que já está no treino.
  - Link "Cadastrar exercício próprio".
- **Item do treino:**
  - +/− para séries, repetições ou tempo, e carga.
  - "Medir por repetições ou tempo".
  - Descanso, observação, subir e descer (arrastar no desktop), remover.
- **Pronto** pergunta o próximo passo: Colocar em um programa ou Voltar aos treinos.
- Usar como base (duplicar), Arquivar e Reativar.
- **Programa** (com a estrutura de dados atual):
  - Nome e vigência com +/−.
  - Lista dos treinos do programa, com a faixa da semana montada pelos dias sugeridos de cada treino.
  - Adicionar treino em *sheet*, reordenar e remover.
- **Atribuir a vários alunos** (BK-03), avisando quem tem programa que será substituído e explicando a cópia (ADR-005).
- As URLs antigas (`/treinos/novo`, `/treinos/[id]`, `/treinos/planos/*`) continuam funcionando no novo editor.

Backend novo: **BK-01, BK-03.**

**Fica para o EPIC-25 (Momento 2):**
- Programa editado dia a dia, com o mesmo treino em vários programas (BK-02).
- Atribuir um treino solto direto ao aluno (BK-04).
- A meta de "aluno novo com treino atribuído em ≤ 2 telas".

### FIT-147 — P5 · Biblioteca de exercícios (`P1`)

**Como** personal, **quero** explorar e manter exercícios com poucos toques, **para** ter meu catálogo do meu jeito.

Critérios de aceite:
- Origem: Todos, Biblioteca, Meus. Busca, chips de músculo, *sheet* Filtros (tipo e dificuldade) com "Mostrar N".
- Detalhe:
  - Foto e crédito da mídia.
  - Tags: músculo, equipamento, tipo, nível.
  - "Como executar" em passos, Segurança, "Usar em um treino".
- Exercício próprio: Editar, Arquivar e Reativar. Arquivar avisa que os treinos que já usam o exercício continuam iguais.
- Exercício da biblioteca: "Criar uma versão minha" (BK-08).
- Cadastrar e editar em *sheet*:
  - Nome.
  - Músculo, equipamento e tipo em chips.
  - "Como executar" opcional.
- Sem foto: placeholder com ícone.

Backend novo: **BK-08.**

### FIT-148 — P6 · Financeiro de um toque (`P0`)

**Como** personal, **quero** registrar recebimentos e gerar mensalidades sem preencher formulário, **para** manter o caixa em dia.

Critérios de aceite:
- Troca de mês da competência.
- Recebido, A receber e Atrasado.
- Aviso de que é controle manual, sem confundir com a assinatura do FitOS.
- Abas Cobranças e Recorrentes.
- Filtro por status: Todas, Atrasadas, A vencer, Pagas, Canceladas.
- "Recebi" em *sheet*:
  - Valor já preenchido.
  - Quando: Hoje, Ontem ou Outra data.
  - Forma: Pix, Dinheiro, Cartão, Transferência.
- Cancelar com motivo em chips.
- "Gerar todas" as mensalidades do mês (BK-09); gerar uma recorrência; encerrar recorrência.
- Nova cobrança ou recorrência em *sheet*:
  - Aluno em chips, valor, dia com +/−, descrição sugerida.
  - "Repetir todo mês" (BK-10).

Backend novo: **BK-09, BK-10.**

### FIT-149 — P7 · Perfil do Personal (`P1`)

**Como** personal, **quero** chegar ao meu negócio e aos meus dados numa tela só, **para** não depender de menus escondidos.

Critérios de aceite:
- "Seu negócio": Financeiro (com resumo), Assinatura (com status) e Exercícios. Substitui o menu do avatar do EPIC-18.
- Editar em *sheet*:
  - Nome do espaço.
  - Perfil profissional: CREF opcional, celular, faixa de alunos em chips.
  - Seus dados.
- Termos e Privacidade; Sair.

Backend novo: nenhum (usa `meu-tenant` e `meu-perfil`).

### FIT-150 — P8 · Assinatura FitOS (`P0`)

**Como** personal, **quero** entender e controlar minha assinatura, **para** não ter surpresa na cobrança.

Critérios de aceite:
- Plano, valor, status (teste, ativa, pendente ou cancelada), progresso do teste, próxima cobrança e uso de alunos (X de Y).
- Cartão (bandeira e final) com "Atualizar" em *sheet*:
  - Número, nome, MM, AAAA, CVV, CEP e número do endereço.
  - CPF ou CNPJ e celular vêm do cadastro.
- Trocar de plano com confirmação. Planos menores que o número de alunos ativos aparecem bloqueados, com o motivo.
- Cancelar com motivo em chips e consequências.
- "Assinar de novo" depois de cancelar (BK-18).
- Aviso de pagamento pendente com chamada para atualizar o cartão.

Backend novo: **BK-18.**

---

## EPIC-20 — Aluno com personal

### FIT-151 — A1 · Início do Aluno com seis estados (`P0`)

**Como** aluno, **quero** abrir o app e saber na hora o que fazer hoje, **para** começar a treinar sem procurar.

Critérios de aceite:
- Estados:
  - Treino do dia: "Começar treino".
  - Em andamento: "Continuar treino", com progresso e tempo.
  - Descanso: próximo treino e "Ver meu programa".
  - Sem programa: o personal já foi avisado (aparece no feed dele, BK-05).
  - Sem vínculo: código de convite e "Treinar por conta própria".
  - Inativo.
- Ritmo da semana, próximos movimentos e cartão da última avaliação.
- Sem vínculo e inativo não mostram a barra inferior.

Backend novo: nenhum (usa `getTodayScheduleForStudent`, `getInProgressSessionForStudent` e `getWeeklyRhythmForStudent`). Depende de **BK-05** para o aviso ao personal.

### FIT-152 — A2 · Seu programa (`P1`)

**Como** aluno, **quero** ver meu programa e o que cada treino tem, **para** me preparar e começar o treino certo.

Critérios de aceite:
- Nome do programa, quem prescreveu, semana X de Y com barra e faixa da semana com o dia de hoje.
- Treinos que abrem e fecham, com a tag "Hoje".
- Exercícios com foto, prescrição e observação do personal.
- "Começar este treino".

Backend novo: nenhum.

### FIT-153 — A3 · Treino ao vivo na academia (`P0`, **segunda entrega de valor**)

**Como** aluno na academia, **quero** registrar cada série com um toque, ver o descanso e ouvir música, **para** treinar sem largar o foco.

Critérios de aceite:
- **Preparação:** treino, exercícios e três opções (Voz e bipes, Tela sempre ligada, Música), com "Começar treino" de 76 px.
- **Em execução:**
  - Cronômetro do treino que pausa ao toque (BK-14).
  - Progresso por exercício.
  - Foto que abre "Como fazer".
  - Observação do personal.
  - Bolinhas das séries.
  - Carga e repetições grandes com botões de 60 px, já com o prescrito.
  - "Última vez: X kg × Y" (BK-12).
  - "Série feita" de 84 px, que registra a série (BK-11).
- **Exercício por tempo:** cronômetro de toque único com contagem, bipes e "Tempo!".
- **Descanso em tela cheia:**
  - Anel de contagem.
  - Bipes nos 3 últimos segundos, vibração e voz com a próxima série.
  - −15 s, +15 s, Pular, e "A seguir".
- **Lista do treino:** trocar a ordem (aparelho ocupado) e pular exercício.
- **Música (BK-15):**
  - Mini player fixo com tocar, pausar e próxima.
  - *Sheet* com playlists, anterior e próxima, e "abaixar a música quando a voz falar".
  - Atalhos para Spotify, Apple Music e YouTube Music quando não conectado.
- **Fim do treino:**
  - Concluir ou abandonar, salvando o que foi feito.
  - Resumo: tempo ativo, séries, volume em kg e novo recorde (BK-12).
  - "Como foi o treino?" de 1 a 5 (BK-13), enviado ao personal.
  - Compartilhar imagem do resultado.
- Retomar sessão em andamento depois de fechar o app (já existe `startOrResume…`).
- Funciona com uma mão: nenhuma ação principal fica fora do alcance do polegar.

Backend novo: **BK-11, BK-12, BK-13, BK-14, BK-15.** ADR-011.

### FIT-154 — A4 · Progresso do Aluno (`P1`)

**Como** aluno, **quero** ver minha evolução de corpo e de treino, **para** me manter motivado.

Critérios de aceite:
- Métrica em chips (Peso, Gordura, Cintura), valor atual e variação.
- Gráfico de linha com rótulos no primeiro e no último ponto, dica no toque e tabela de dados acessível.
- Medidas da primeira para a última avaliação, com a variação.
- Histórico de avaliações.
- Bloco Treinos: treinos no mês e melhores cargas (BK-12).

Backend novo: usa **BK-12.**

### FIT-155 — A5 · Perfil do Aluno (`P2`)

**Como** aluno, **quero** ver meus dados e quem é meu personal, **para** saber com quem falar.

Critérios de aceite:
- Personal vinculado (nome, espaço, CREF).
- Editar nome e e-mail em *sheet*.
- Termos e Privacidade; Sair.
- Texto explicando que mensalidade e programa são combinados com o personal.

Backend novo: nenhum (avaliar se a rota de edição do aluno pelo próprio aluno existe; se não existir, entra aqui).

---

## EPIC-21 — FitOS Livre

### FIT-156 — L1 · Início do Livre (`P0`)

**Como** usuário do FitOS Livre, **quero** ver o treino de hoje e minha semana, **para** treinar no meu ritmo.

Critérios de aceite:
- "Hoje para você" com "Iniciar treino" (BK-16).
- Semana com a meta do perfil (dias por semana).
- Seus treinos com "Iniciar"; "+ Montar meu treino".
- Resumo de evolução: treinos no mês e metas em andamento.
- Primeiro acesso sem treinos: "Criar meu primeiro treino".

Backend novo: **BK-16.**

### FIT-157 — L2 · Meus treinos com o mesmo editor do Personal (`P0`)

**Como** usuário do FitOS Livre, **quero** montar meus treinos pela biblioteca com +/−, **para** não preencher formulário.

Critérios de aceite:
- O editor da FIT-146 com papel Livre: abas Treinos e Exercícios, sem Programas nem Atribuir.
- Começar, Usar como base, Arquivar e Reativar.
- Dias sugeridos (BK-16).
- "Pronto" oferece "Começar agora".

Backend novo: **BK-01, BK-16.**

### FIT-158 — L3 · Treino ao vivo do Livre (`P0`)

**Como** usuário do FitOS Livre, **quero** a mesma execução do aluno, **para** registrar meu treino com a mesma facilidade.

Critérios de aceite:
- Reaproveita o componente da FIT-153. O esforço percebido fica no próprio histórico (não há personal).
- O fim do treino leva a Minha evolução.

Backend novo: **BK-11 a BK-15** (os mesmos da FIT-153).

### FIT-159 — L4 · Minha evolução (`P1`)

**Como** usuário do FitOS Livre, **quero** ver frequência, recordes, medidas e metas num só lugar, **para** acompanhar meu progresso sozinho.

Critérios de aceite:
- Abas Treinos, Corpo e Metas.
- **Treinos:** semana, mês, semanas seguidas, recordes por série (BK-12) e histórico concluído ou abandonado.
- **Corpo:** registrar peso e gordura com +/− (já com os últimos valores), observação, excluir.
- **Metas:** nova meta (texto e data-alvo em chips: sem data, 1, 3 ou 6 meses), Concluí, Abandonar, e encerradas.

Backend novo: usa **BK-12** ("semanas seguidas" calculado em `history.ts`).

### FIT-160 — L5 · Perfil do Livre (`P1`)

**Como** usuário do FitOS Livre, **quero** ajustar meu perfil de treino com toques, **para** manter as sugestões certas.

Critérios de aceite:
- Objetivo, experiência e disponibilidade editáveis em chips numa *sheet* ("Editar respostas").
- Assinatura com status.
- Dados e nome do espaço.
- Termos; Sair.

Backend novo: nenhum.

### FIT-161 — L6 · Assinatura do Livre (`P1`)

**Como** usuário do FitOS Livre, **quero** gerenciar minha assinatura, **para** ter controle do que pago.

Critérios de aceite:
- O componente da FIT-150 com papel Livre: um plano (R$ 19,90), cartão, cancelar e assinar de novo.
- Sem uso de alunos.

Backend novo: usa **BK-18.**

---

## EPIC-22 — Entrada, cadastro e onboarding

### FIT-162 — E1 · Abertura (`P2`)

**Como** visitante, **quero** uma abertura rápida da marca, **para** reconhecer o app.

Critérios de aceite:
- Marca sobre fundo liso.
- Some sozinha ou com um toque.
- Respeita `prefers-reduced-motion`.
- Não atrasa quem já tem sessão: vai direto ao Início.

Backend novo: nenhum.

### FIT-163 — E2 · Entrar (`P0`)

**Como** usuário, **quero** entrar rápido, **para** chegar logo ao meu Início.

Critérios de aceite:
- E-mail e senha com o erro junto do campo.
- "Começar agora" e "Recebi um convite".
- Rodapé com Termos e Privacidade.

Backend novo: nenhum.

**Fica para o EPIC-24 (Momento 2):** "Esqueci minha senha", que depende do envio de e-mail.

### FIT-164 — E3 · Começar e criar conta (`P0`)

**Como** visitante, **quero** escolher meu caminho e criar a conta em uma tela, **para** começar sem atrito.

Critérios de aceite:
- Três caminhos em cartões: Sou personal, Tenho convite, Treino por conta.
- Convite: código ou link.
- Criar conta com nome, e-mail e senha (com Mostrar). **Sem "Confirmar senha".**
- Aceite dos termos.
- Segue para o onboarding do papel escolhido.

Backend novo: nenhum.

### FIT-165 — E4 · Ativar convite (`P0`)

**Como** aluno convidado, **quero** ver quem me convidou e só criar a senha, **para** entrar em segundos.

Critérios de aceite:
- Personal e espaço visíveis.
- E-mail fixo, só a senha.
- Leva direto ao Início do Aluno.
- Estados de convite expirado (7 dias) e cancelado, com saídas: "Já tenho conta" e "Treinar por conta própria".

Backend novo: nenhum.

### FIT-166 — E5 · Onboarding do Personal em 4 passos (`P0`)

**Como** novo personal, **quero** configurar meu espaço e plano com toques, **para** chegar logo ao meu painel.

Critérios de aceite:
1. **Perfil:** nome do espaço, faixa de alunos em cartões, celular, CREF opcional.
2. **Plano:** sugerido pela faixa.
3. **Pagamento:** CPF ou CNPJ e cartão, com a data da primeira cobrança explícita.
4. **Revisão:** "Começar meus 30 dias grátis".

- Voltar mantém os dados.

Backend novo: nenhum.

### FIT-167 — E6 · Onboarding do Livre em 4 passos (`P0`)

**Como** novo usuário do FitOS Livre, **quero** responder em toques e começar, **para** montar meu primeiro treino logo.

Critérios de aceite:
1. Objetivo.
2. Experiência e dias por semana (todos em cartões).
3. Plano e pagamento.
4. Revisão, levando direto a "Montar meu primeiro treino".

Backend novo: nenhum.

### FIT-168 — E7 · Conheça o FitOS (`P1`)

**Como** visitante, **quero** entender a proposta em poucos segundos, **para** decidir se começo.

Critérios de aceite:
- Promessa, três benefícios numerados, biblioteca ilustrada com fotos reais, "Personal e aluno na mesma rotina".
- Três caminhos com preço real.
- CTA final e rodapé com termos.
- Só dados reais (sem números inventados).

Backend novo: nenhum.

### FIT-169 — E8 · Página pública do FitOS Livre (`P2`)

**Como** visitante, **quero** saber o que o FitOS Livre faz e o que não faz, **para** escolher com clareza.

Critérios de aceite:
- O que pode e o que não é.
- Preço e teste.
- "Começar 30 dias grátis".

Backend novo: nenhum.

### FIT-170 — E9 · Termos e Privacidade (`P2`)

**Como** usuário, **quero** ler os termos e a política num lugar legível, **para** saber como meus dados são tratados.

Critérios de aceite:
- Abas Termos e Privacidade numa leitura confortável.
- Conteúdo **sem mudança de texto**.
- As URLs atuais (`/termos-de-uso`, `/politica-de-privacidade`) continuam valendo.

Backend novo: nenhum.

---

## Ordem de execução proposta

Um PR por História, a partir de branch própria, nunca direto na `main` (`GOVERNANCA.md`).

| Sprint | Histórias | Por quê |
|---|---|---|
| **S12 — Fundação** | FIT-171 | Tema liso e componentes que todas as outras usam |
| **S13 — Montar treino** | FIT-146 (BK-01, BK-03), FIT-147 (BK-08), FIT-157 (BK-16) | A dor principal: gestão de treinos |
| **S14 — Treino ao vivo** | FIT-153 (BK-11 a BK-15), FIT-158 | O momento de uso mais frequente do aluno |
| **S15 — Rotina do Personal** | FIT-143 (BK-05, BK-06), FIT-144 (BK-07), FIT-145 (BK-13) | Ações no contexto; depende de dados da S14 (esforço, sessões) |
| **S16 — Negócio** | FIT-148 (BK-09, BK-10), FIT-149, FIT-150 (BK-18), FIT-161 | Financeiro e assinatura |
| **S17 — Aluno e Livre** | FIT-151, FIT-152, FIT-154, FIT-155, FIT-156, FIT-159, FIT-160 | Telas de consulta sobre dados já prontos |
| **S18 — Entrada** | FIT-162 a FIT-170 | Cadastro, onboarding e páginas públicas |

## Decisões pendentes (bloqueiam itens específicos)

| # | Decisão | Bloqueia | Proposta |
|---|---|---|---|
| D1 | **Integração com Spotify** | BK-15 → música da FIT-153/158 | App no Spotify for Developers (Client ID, OAuth PKCE). **Limites do Spotify:** controle de reprodução só para contas **Premium**; em modo de desenvolvimento, só **25 usuários** liberados até o Spotify aprovar cota estendida. Sem Premium, ficam os atalhos para os apps. Alternativa: entregar só os atalhos agora e o Spotify depois |
| D2 | **Desktop** | Todas | O protótipo é mobile. Proposta: mesmos componentes no layout de rail atual (≥ 840 px), sem prévia desktop separada |
| D3 | **Ordem das sprints** acima | Planejamento | Confirmar ou reordenar |

O provedor de e-mail deixou de ser decisão do Momento 1: passou para o EPIC-24.

---

## Momento 2 — Épicos de evolução

Registrados por decisão de Murilo em 04/10/2026. Ainda **não detalhados em Histórias** e **sem numeração FIT**: serão detalhados quando forem priorizados, depois do Momento 1. Os itens abaixo são o escopo candidato.

### EPIC-24 — Comunicação com o aluno por e-mail e push

**Objetivo:** o FitOS passa a falar com o aluno (e com o personal) fora do app, com consentimento e controle de quem recebe.

Escopo candidato:
- **Infraestrutura de e-mail transacional (BK-17):** provedor (proposta: Resend), domínio remetente verificado, modelos de e-mail em PT-BR e registro de envios para auditoria.
- **Infraestrutura de push na web:**
  - Instalação como app (PWA) e service worker.
  - Chaves VAPID.
  - Pedido de permissão no momento certo (nunca na primeira abertura).
  - Inscrição por aparelho.
  - **Limite conhecido:** no iPhone, push na web só funciona com o app adicionado à tela de início (iOS 16.4 ou mais novo).
- **Preferências de notificação** por usuário e por tipo (ligar ou desligar), em conformidade com a LGPD.
- **Recuperação de senha** ("Esqueci minha senha", que saiu da FIT-163).
- **Convite do aluno também por e-mail**, além do link copiado.
- **Avisos ao aluno:**
  - Vínculo encerrado, conta inativada ou reativada.
  - Programa novo atribuído e programa terminando.
  - Mensalidade a vencer ou atrasada (só aviso; a cobrança continua manual).
- **Lembrete de treino** nos dias do programa (push).
- **Avisos ao personal:** treino concluído, esforço alto relatado (BK-13), aluno sem treino na semana.

Decisões que o épico vai pedir: provedor e domínio de e-mail, chaves de push, quais avisos nascem ligados por padrão.

### EPIC-25 — Revisão do módulo de construção de treinos

**Objetivo:** dar aos treinos uma evolução clara ao longo do tempo, a partir do editor sem formulário entregue na FIT-146.

Escopo candidato:
- **Modelo de dados:** o mesmo treino reutilizado em vários programas (BK-02). Decidir entre cópia ao colocar no programa ou relação N:N, registrando num ADR.
- **Programa editado dia a dia:** semana de segunda a domingo, com treino, descanso e "montar um treino novo" direto no dia (como no protótipo P4).
- **Atribuir um treino solto** direto ao aluno, com programa criado automaticamente (BK-04). Meta: aluno novo com treino atribuído em ≤ 2 telas.
- **Ajustar o programa de um aluno** sem alterar o modelo original (hoje a cópia atribuída é imutável, ADR-005).
- **Progressão planejada** semana a semana (carga, repetições, séries), com periodização simples.
- **Sugestão de progressão** a partir do registro por série (BK-11) e do esforço percebido (BK-13).
- **Modelos prontos** de programa para começar mais rápido.
- **Técnicas de treino:** bi-set, drop-set, aquecimento.
- **Histórico de versões** do programa.

## Fora deste backlog

- Notificações por WhatsApp.
- Player com músicas próprias do FitOS (exige licenciamento).
- Gestão de agenda e aulas.
- Mudança de preço ou de regras de cobrança.

## Definition of Done adicional destes épicos

Além de `DEFINITION-OF-DONE.md`:

- Tela confere com o protótipo aprovado (tela correspondente citada no PR).
- Nenhuma ação principal exige digitação quando existe uma escolha possível.
- Alvos de toque ≥ 44 px (≥ 60 px na execução de treino).
- Testes de integração para todo backend novo (BK-xx), com isolamento entre espaços.
- Migrações reversíveis e compatíveis com os dados atuais.
