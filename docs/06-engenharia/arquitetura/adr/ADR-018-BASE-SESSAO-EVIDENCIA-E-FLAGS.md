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

## Adendo: retroativo, parte 2 (edição, exclusão e período consolidado)

- **Treinos realizados** (`/painel/treinos-realizados`) valem para aluno e Livre:
  - lista com "Registrado" e a situação dos pontos ("Salvo sem pontuação", "N pontos");
  - detalhe com fotos (anexar depois, remover), pontos, "Editar registro" e "Excluir treino".
  - O registro saiu de `/painel/meus-treinos/registrar` (que redireciona) para `/painel/treinos-realizados/registrar`, aberto também ao aluno.
- **Editar** (`PUT /api/minhas-sessoes/[id]/registro`):
  - só treino `RETROATIVO` concluído, enquanto a data da realização está no prazo de 7 dias, e a nova data também;
  - a versão anterior (data, duração, exercícios, séries, fotos e pontos) vai para `WorkoutSessionRevision` (`EDITADO`);
  - a pontuação é recalculada pela diferença (`RECALCULADO`), uma vez, sem duplicar; com foto no novo prazo, libera.
- **Excluir**: a versão excluída e os pontos de antes ficam na trilha (`EXCLUIDO`), que não tem chave para a sessão e sobrevive à exclusão. O aluno só exclui o que ele mesmo registrou; o Livre, qualquer treino seu.
- **Período consolidado**:
  - Semana e mês consolidam 24 h depois do fim.
  - Depois disso, contam só os pontos liberados até a consolidação. O valor fica congelado em `PeriodGoal.finalTenths` na primeira leitura.
  - Registro tardio, edição ou exclusão não mudam medalha já consolidada. O cartão de pontos avisa: "Treino salvo no histórico. Este desafio já foi encerrado."
  - **Limite conhecido:** um período nunca lido depois de consolidado congela com o que existir na primeira leitura.

## Adendo (12/10/2026): flags ligadas por padrão

A pedido do produto, as features `RETROATIVO`, `GAMIFICACAO`, `FUNCIONAL` e `CUPONS` passam a vir **ligadas por padrão** no deploy, sem precisar configurar variável no Railway.

- **Desligar num ambiente:** basta definir `FEATURE_<NOME>=off`. Com a variável definida, só `on` liga.
- **Features novas:** entram na mesma lista e já chegam ligadas.
- **Escritas no Asaas:** `GRATUIDADE_ASAAS` e `CUPONS_ASAAS` ficam fora da lista e continuam desligadas até a validação no Sandbox (runbooks).
- **Testes:** partem das features desligadas (`src/test/setup.ts`) e ligam cada uma com `vi.stubEnv`, como antes.
