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

## Adendo — etapa 3: execução ao vivo por bloco

- **Modelo:** `WorkoutBlockResult`, uma linha por sessão e bloco (`@@unique([sessionId, blockKey])`).
  - Guarda os instantes do timer: `startedAt`, `pausedAt`, `pausedSeconds` e `endedAt`. O servidor marca o tempo, e o cliente só pede INICIAR, PAUSAR ou RETOMAR.
  - Guarda também o resultado: `outcome`, `roundsCompleted`, `partialReps`, `intervalsCompleted`, `elapsedSeconds` e `note`.
- **Regras:**
  - só há timer e resultado com a sessão EM_ANDAMENTO e um bloco que existe no treino;
  - as ações do timer são idempotentes;
  - uma pausa aberta no encerramento é descontada;
  - reenviar o resultado corrige o registro e mantém o `endedAt` original.
- **For Time:**
  - "Concluído" grava o tempo medido;
  - "Limite atingido" (só com limite definido) não grava tempo, e o banco garante isso com uma CHECK;
  - "Parei antes" grava o round parcial.
- **A meta não conta como feito.** O formulário de encerramento começa do zero. No EMOM, sugere os intervalos que o relógio já fechou.
- **Rotas:** `PUT …/[id]/blocos/[key]` e `POST …/[id]/blocos/[key]/timer`, em `/api/workout-sessions` (aluno) e `/api/minhas-sessoes` (Livre). Respondem 404 sem `FEATURE_FUNCIONAL`.
- **Tela:** o treino ao vivo mostra o painel do bloco acima do exercício atual quando o item pertence a um bloco. O painel tem formato, tempo restante (ou intervalo x de N), Iniciar, Pausar, Retomar, Encerrar bloco e Corrigir resultado.
- **Fora desta etapa:** pontuação por bloco. Os pontos continuam pelas séries registradas.

## Adendo — etapa 4: blocos no treino retroativo

- **Registro:** com `FEATURE_FUNCIONAL`, "Registrar treino realizado" aceita blocos. Cada um leva o formato (o mesmo `parseBlock` do editor) e o resultado declarado: voltas, round parcial, intervalos, "como terminou" e o tempo do For Time concluído.
- **Exercícios do bloco:** o exercício recebe o `blockKey` do bloco e não precisa de séries, porque conta pelo resultado do bloco.
- **Validação:**
  - cada bloco precisa de pelo menos um exercício;
  - chave desconhecida é recusada;
  - For Time "Concluído" exige o tempo declarado;
  - "Limite atingido" nunca grava tempo.
- **Validação compartilhada:** `parseBlockOutcome` vale para o ao vivo e para o retroativo.
- **Gravação:**
  - `workout.blocks` e `WorkoutBlockResult` (sem `startedAt`, com `endedAt` no fim declarado do treino), na mesma transação do registro;
  - editar apaga e regrava blocos e resultados;
  - a trilha (`WorkoutSessionRevision.snapshot`) guarda os blocos, os resultados e o `blockKey` de antes.
- **Detalhe do treino realizado:** ao vivo ou retroativo, mostra cada bloco com o resultado ("Concluído em 9:42", "5 voltas + 8 reps") e os exercícios dele.
- **Flag desligada:** as rotas ignoram `blocks` e `blockKey`, e o registro volta a exigir séries em todos os exercícios.
- **Pontuação:** continua pelas séries. Exercícios só de bloco ainda não pontuam, até haver política aprovada por métrica.
