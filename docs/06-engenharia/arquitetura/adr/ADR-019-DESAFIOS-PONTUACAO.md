# ADR-019 — FitOS Desafios: motor de pontuação, referência congelada e liberação por foto

Status: **Aceito** (feature 3, etapas 1 e 2 de 6)
Data: 11 de outubro de 2026

## Contexto

O PDF "3-Gamificacao" confirma as fórmulas (volume de musculação, +1 por 10% acima; aeróbico +1 por 10 min acima), a foto como evidência, a liberação automática com contestação e as três visões (Amigos, Alunos, Conquistas). Os parâmetros recomendados no PDF foram definidos e aplicados por decisão de Murilo ("Defina e me aplique"); sem carga, vale repetições × séries.

## Decisões

1. **Motor puro** (`src/shared/lib/scoring.ts`), com pontos em décimos (inteiros).
   - **Musculação:** volume = Σ repetições × carga por série. Na referência vale 10; acima, `10 + ⌊(volume/ref − 1) × 10⌋`; abaixo, proporcional com uma casa decimal. **Teto de 20.**
   - **Sem carga:** repetições × séries no lugar do volume, com a mesma fórmula.
   - **Aeróbico:** tempo do item. Referência = tempo prescrito ou 30 min. Acima, +1 por 10 min inteiros; abaixo, proporcional. **Teto de 15.**
   - **Sem referência positiva:** zero.
2. **Referência individual congelada** (`ScoringReference`): uma ativa por aluno, exercício e medida, com índice único parcial.
   - É criada na primeira pontuação: da prescrição do programa (séries × reps × carga) ou, sem carga prescrita ou em treino avulso/retroativo, da **primeira execução**.
   - Mudança de programa não reduz nada retroativamente: uma versão nova fica para uma etapa futura, com `supersededAt` na anterior.
   - "Aparelho ocupado" pontua pelo exercício feito.
3. **Uma pontuação por sessão** (`SessionScore`, `sessionId` único), calculada no servidor ao concluir. Idempotente: recalcular só muda se o total mudar, e gera o evento `RECALCULADO`.
   - **Total:** a soma dos itens.
   - **Equilibrado:** a média dos itens previstos; os não feitos contam zero.
   - **Falha na pontuação nunca impede concluir** (`scoreSessionSafely`, que loga e segue).
4. **Liberação por foto**, sem aprovação prévia:
   - **Prazos:** 24 h depois do treino ao vivo; 7 dias da realização no retroativo.
   - **Sem foto:** `PENDENTE_FOTO`, fora do placar oficial.
   - **Com foto no prazo:** `LIBERADO`.
   - **Última foto removida:** volta a `PENDENTE_FOTO` (estorno).
   - Contestação (`CONTESTADO`, `MANTIDO`, `ANULADO`) fica para a etapa 6.
   - Placar oficial: `LIBERADO`, `CONTESTADO` e `MANTIDO`.
5. **Trilha auditável** (`ScoreEvent`): calculado, liberado, estornado e recalculado, com status antes/depois. Excluir o treino leva a pontuação junto (cascata).
6. **Tudo atrás de `FEATURE_GAMIFICACAO`.** Treinos anteriores à ligação não são pontuados retroativamente.

## Metas e medalhas (etapa 3)

- **Períodos:** semana de segunda a domingo e mês do calendário, em America/Sao_Paulo (`src/shared/lib/medals.ts`).
- **Meta** = 10 × dias de treino previstos no período × exercícios por treino.
  - **Dias:** os "meus dias" do aluno contados no período; sem dias definidos, 3 por semana.
  - **Exercícios por treino:** a mediana dos treinos pontuados nos 28 dias antes do período; sem histórico, 5. Sem nada configurado, 150 por semana.
- **Meta congelada** (`PeriodGoal`) na primeira vez que o período é lido. Mudar os dias depois não muda a meta do período.
- **Medalha não é guardada.** Ela sai dos pontos oficiais (`LIBERADO`, `CONTESTADO`, `MANTIDO`) contra a meta congelada, então um estorno revisa a medalha sozinho e o resultado pode ser recalculado.
  - **Faixas:** Bronze 50%, Prata 75%, Ouro 100%, Platina 110%.
  - **Limiar:** arredondado para cima em pontos inteiros.
  - **Uma medalha por período**, com upgrade. Badge não dá pontos.
- **O diário pessoal soma todos os treinos liberados.** O limite de 3 treinos por semana é só do ranking.
- **Tela `/painel/desafios`:** meta, medalha atual, "135/180 pontos · faltam 45 para Ouro", faixas e galeria (8 semanas e 6 meses encerrados, com pontos).

## Ranking da turma (etapa 4)

- **Ligado pelo personal** (`ClassRanking`). Ligar começa uma temporada nova (`activatedAt`); desligar só esconde, sem apagar nada.
- **Adesão voluntária do aluno** (`ClassRankingParticipant`):
  - entrar mostra as regras antes;
  - sair grava `leftAt`; voltar recomeça a contagem;
  - só alunos com vínculo ativo, e quem encerra o vínculo some da lista.
- **Conta só treino oficial** feito depois da ativação e da adesão: nada é importado retroativamente.
- **Modo equilibrado** (`src/shared/lib/ranking.ts`):
  - cada treino vale `balancedTenths`;
  - no máximo 1 por dia (o melhor) e os 3 melhores da semana;
  - o mês soma as semanas;
  - empates dividem a posição.
- **Visibilidade:** o personal e os alunos que aderiram.
  - Colegas veem nome, foto e pontos.
  - O personal vê também os treinos na conta e a contestação.
  - Nunca cargas, programa, saúde ou foto de evidência.
- **Telas:** aba "Turma" em Desafios (aluno) e "Ranking da turma" para o personal (link em Alunos).

## Próximas etapas

3. ~~Metas e medalhas~~ (acima).
4. ~~Ranking dos alunos~~ (acima).
5. Amigos: grupos por convite, temporadas de 7, 14 ou 28 dias.
6. Contestação:
   - abrir em até 48 h e decidir em até 48 h;
   - não se encerra por silêncio;
   - o treino do próprio moderador é revisado por outra pessoa.

## Adendo: Amigos (Desafios 4/4, parte A)

- **Grupo privado por convite** (`FriendGroup`, fora de tenant):
  - reúne quem treina, inclusive alunos de personais diferentes e Livre;
  - código de 8 caracteres sem 0/O e 1/I/L, para ditar sem confusão;
  - limites: 50 pessoas por grupo e 10 grupos por pessoa.
- **Membro** (`FriendGroupMember`): guarda o escopo de treino (`tenantId` + `studentId`) do momento em que entrou.
  - **Sair** grava `leftAt`: os treinos param de contar e a pessoa perde a leitura do grupo. No placar da temporada, quem saiu aparece sinalizado com o que somou até sair.
  - **Voltar** recomeça a contagem.
  - **Organizador:** quem cria. Se sair, a organização passa para quem está há mais tempo.
- **Temporada** (`FriendSeason`): 7, 14 ou 28 dias, uma de cada vez.
  - O organizador começa a próxima quando a atual acaba.
  - Conta só treino com pontos oficiais, feito dentro da temporada e depois da entrada.
  - Temporada encerrada consolida como os períodos das medalhas: 24 h depois do fim, só o que foi liberado até lá.
- **Modo:** escolhido na criação.
  - `TOTAL`: soma dos pontos.
  - `EQUILIBRADO`: média por exercício, 1 treino por dia, 3 melhores por semana (`rankSeason`).
- **Antes de entrar**, o convite mostra o modo, a temporada e as regras. Os colegas veem só nome, foto do perfil e pontos.
- **Rotas:**
  - `POST /api/desafios/amigos` (criar);
  - `/entrar` (pelo código);
  - `/[id]/temporada`;
  - `/[id]/sair`.
  - Todas valem sempre sobre quem treina e dão 404 sem `FEATURE_GAMIFICACAO`.
- **Contestação** (parte B) vem a seguir.

## Adendo: Contestação (Desafios 4/4, parte B)

- **Quem contesta:** quem participa, sobre treino de outra pessoa, pelo resumo mínimo (data e pontos).
  - No grupo de amigos: membro ativo, sobre treino de outro membro que conta numa temporada do grupo.
  - Na turma: aluno que aderiu, sobre colega que também aderiu.
  - Prazo: até 24 h depois da liberação dos pontos.
- **Revisor** (`ScoreContest.reviewerUserId`):
  - na turma, o personal;
  - no grupo, o organizador;
  - se o treino ou a contestação for do organizador, revisa quem está há mais tempo no grupo e não é parte do caso;
  - sem ninguém assim, o caso não abre ("precisa de mais alguém").
- **Pontos durante o caso:** ficam `CONTESTADO` e continuam valendo, sinalizados no placar. Caso aberto não se encerra sozinho.
- **Decisão:** manter ou anular, sempre com justificativa.
  - Manter vira `MANTIDO`; anular vira `ANULADO` e sai do placar e das medalhas abertas.
  - Período já consolidado não muda.
  - Cada passo fica em `ScoreEvent` (quem fez e por quê).
- **Sem duplicar** (índices parciais):
  - uma contestação aberta por treino;
  - o mesmo participante não contesta o mesmo treino duas vezes;
  - treino mantido não volta a ser contestado.
- **Recurso:** o autor recorre uma vez de uma anulação, em até 48 h. Vai para alguém fora do caso (autor, quem contestou, quem decidiu); sem ninguém assim, volta para quem decidiu reexaminar.
- **Privacidade:**
  - A foto do treino contestado fica visível só para o autor e para o revisor do caso aberto, inclusive de outro espaço (`evidenceForReviewer`).
  - O autor vê a situação e a decisão, nunca quem contestou.
- **Rotas:**
  - `POST /api/desafios/contestacoes`;
  - `/[id]/decisao`;
  - `/recurso`.
  - 404 sem `FEATURE_GAMIFICACAO`.
