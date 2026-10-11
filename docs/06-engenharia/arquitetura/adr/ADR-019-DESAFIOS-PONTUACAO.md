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

## Próximas etapas

3. Metas e medalhas:
   - meta = 10 × exercícios previstos, ou 150/semana sem plano;
   - faixas: Bronze 50%, Prata 75%, Ouro 100%, Platina 110%;
   - períodos: semana de segunda a domingo e mês do calendário, em America/Sao_Paulo.
4. Ranking dos alunos: equilibrado, com os 3 melhores treinos por semana e no máximo 1 por dia.
5. Amigos: grupos por convite, temporadas de 7, 14 ou 28 dias.
6. Contestação:
   - abrir em até 48 h e decidir em até 48 h;
   - não se encerra por silêncio;
   - o treino do próprio moderador é revisado por outra pessoa.
