# ADR-018 — Base das novas features: modo da sessão, datas, foto de evidência e feature flags

Status: **Aceito** (Fase 0 do plano das 6 features, outubro/2026)
Data: 11 de outubro de 2026

## Contexto

Treino retroativo (feature 2), Gamificação (feature 3) e Cupons/Funcional dependem de peças comuns: saber **quando** um treino aconteceu (não só quando foi registrado), distinguir treino com cronômetro de treino registrado depois, guardar uma **foto de evidência** por treino (a foto libera os pontos) e entregar código desligado até a validação.

## Decisões

1. **`WorkoutSession.mode`** (`LIVE` | `RETROATIVO`, padrão `LIVE`). Um treino retroativo é uma sessão como as outras: mesmo histórico, mesmas séries, mesma avaliação. Nada de tabela paralela.
2. **Duas datas.** `performedAt` é quando o treino aconteceu (nulo no `LIVE`, que vale `startedAt`); `recordedAt` é quando foi registrado. Os existentes recebem `recordedAt = startedAt` na migration. `sessionPerformedAt()` é a única leitura da data de realização: ranking, desafios e prazos usam ela.
3. **`declaredDurationSeconds`**: duração total informada no retroativo, declaratória, sem cronômetro. CHECK no banco: maior que zero e até 24 h. `activeSeconds` continua sendo o tempo medido pelo cronômetro.
4. **`operationKey` único** na sessão: retry ou clique repetido não cria dois registros.
5. **Integridade no banco:** um retroativo exige `performedAt` (CHECK).
6. **`WorkoutEvidencePhoto`**, no mesmo padrão das fotos de evolução (ADR/EPIC-35):
   - a foto é reduzida no aparelho e guardada no banco, sem URL pública;
   - é lida por `GET /api/evidencias-treino/[id]` pelo próprio aluno/Livre e pelo personal do espaço;
   - só quem treinou envia (`POST /api/minhas-sessoes/[id]/evidencias`) e exclui;
   - aceita até 3 fotos por treino;
   - `(sessionId, sha256)` único: reenviar a mesma foto devolve a gravada;
   - trava por treino, para o limite valer com envios em paralelo;
   - sai em cascata com o treino e com a conta.

   A foto é evidência enviada pelo cliente. O sistema não afirma que ela comprova carga, duração ou data.
7. **Feature flags** em `src/shared/config/features.ts`: `FEATURE_RETROATIVO`, `FEATURE_GAMIFICACAO`, `FEATURE_CUPONS` e `FEATURE_FUNCIONAL`.
   - Ligam com `on`; o padrão é desligado.
   - Só o servidor lê; o cliente recebe o resultado por props.

## Consequências

- O retroativo (feature 2) cria sessões `RETROATIVO` com `performedAt`, `declaredDurationSeconds` e `operationKey`, e usa as rotas de evidência.
- A gamificação (feature 3) pontua por `sessionPerformedAt()` e só libera pontos com evidência (`evidenceCounts`). Excluir a última foto reverte os pontos (regra da gamificação).
- Exportação de dados (CSV) não inclui as fotos, como já acontece com as fotos de evolução.
