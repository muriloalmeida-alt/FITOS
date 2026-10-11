# ADR-020 — Funcional e CrossFit: catálogo, blocos do treino e metas por métrica

Status: **Aceito** (feature 1, etapas 1 e 2)
Data: 11 de outubro de 2026

## Contexto

O PDF "1-CrossFit_Funcionais" pede catálogo com categorias, músculos secundários e busca por nomes alternativos (etapa 1, #215), e treinos em blocos: circuito, AMRAP, EMOM e For Time, com metas compatíveis com cada exercício (distância, calorias, sustentação). O treino tradicional por séries precisa continuar igual, e as cópias (duplicar, cópia do aluno, biblioteca) não podem perder nada.

## Decisões

1. **Blocos como JSON no treino** (`Workout.blocks`). Cada item aponta para o bloco por `WorkoutExercise.blockKey`.
   - Uma tabela própria exigiria remapear chaves em cada caminho de cópia. Com JSON e chave estável, a cópia leva os dois sem tradução.
   - A regra e a validação são puras (`shared/lib/workoutBlocks.ts`). Cada formato exige só o que o define:
     - circuito: voltas;
     - AMRAP: janela;
     - EMOM: intervalos, com 60 s por padrão;
     - For Time: rounds e limite, ambos opcionais.
   - A leitura do banco é tolerante: bloco inválido é ignorado e nunca derruba a tela.
2. **Sem bloco = séries tradicionais.** Remover um bloco devolve os itens às séries, no servidor e na tela.
3. **Metas por métrica no item:**
   - distância (`targetDistanceMeters`) e calorias do equipamento (`targetCalories`), com CHECK de maior que zero;
   - sustentação usa a `durationSeconds` que já existe;
   - carga continua opcional: nunca obrigatória para prancha, nem distância para clean.
4. **Cópias:**
   - `itemCopyFields` e `workoutBlocksCopy` concentram o que um item e um treino levam: duplicar, cópia do aluno (ADR-005), ajuste da cópia, repetir programa e treino da biblioteca para o aluno;
   - caminhos novos de cópia devem usar esses dois.
5. **Flag:**
   - `FEATURE_FUNCIONAL` liga a seção Blocos no editor (Personal e Livre) e os campos nas rotas;
   - desligada, as rotas ignoram `blocks`, `blockKey` e as metas;
   - o catálogo (etapa 1) não depende da flag.
6. **Tempos são metas.** Janela, intervalo e limite descrevem a prescrição. Medição é da execução ao vivo (próxima etapa); o retroativo continua com um único tempo total.

## Consequências

- **Próximas etapas:**
  - execução ao vivo por bloco: timer do bloco, voltas e round parcial, For Time "concluído" × "limite atingido";
  - blocos no retroativo, só com o resultado quantitativo;
  - pontuação por métrica, quando houver política aprovada para movimentos sem carga.
- Treinos sem blocos não mudam em nada (coluna nula).
