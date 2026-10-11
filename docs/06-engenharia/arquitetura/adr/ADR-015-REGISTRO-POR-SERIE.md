# ADR-015 — Registro por série na execução do treino

Status: **Aceito** (FIT-153, EPIC-20)
Data: 5 de outubro de 2026

## Contexto

O treino ao vivo do protótipo (A3) registra **cada série** com um toque ("Série feita"), com a carga e as repetições daquela série, mostra "Última vez: X kg × Y" e aponta novos recordes. Até aqui a execução guardava um único `WorkoutSessionResult` por item do treino (`@@unique([workoutSessionId, workoutExerciseId])`): séries feitas, repetições, tempo e carga em texto livre. Esse agregado não diz qual carga foi usada em qual série, nem permite desfazer uma série marcada por engano.

O agregado é lido por histórico, recordes (`listPersonalRecordsForStudent`), perfil do aluno no personal e telas do FitOS Livre.

## Decisão

1. **Nova tabela `workout_set_results`** (`WorkoutSetResult`): sessão, item do treino, número da série, repetições **ou** segundos, carga em **gramas** (`Int`, mesmo princípio de `Assessment.weightGrams`: nada de ponto flutuante binário) e horário. Única por sessão + item + número da série: reenviar a mesma série substitui os valores, nunca duplica (defesa física contra toque duplo, igual ao agregado).
2. **O agregado continua existindo e é mantido a cada série**, na mesma transação: séries feitas = quantidade de linhas; carga = a maior; repetições = as da série com a maior carga; tempo = o maior. Assim recordes, histórico e telas antigas continuam corretos sem migração de dado e sem dois caminhos de leitura.
3. **"Última vez" e recordes leem o agregado** da sessão concluída mais recente (BK-12). Como o agregado guarda a melhor série de cada sessão, a leitura é a mesma para sessões antigas (antes desta tabela) e novas.
4. **Recorde** só existe quando há histórico: a primeira vez num exercício não é recorde. Compara com a maior carga de sessões **concluídas**, excluindo a própria sessão.
5. **Tempo ativo (BK-14)** é informado pelo aparelho ao concluir (`activeSeconds`, o cronômetro sem as pausas) e limitado ao tempo de relógio da sessão no servidor. Não guardamos cada pausa: só o total importa para o resumo e para o personal.
6. **Esforço percebido (BK-13)** é respondido no resumo, depois de concluir (`rateWorkoutSession`), e pode ser trocado.

## Alternativas consideradas

- **Guardar as séries num JSON dentro do agregado.** Rejeitado: perde a unicidade física por série e complica consultas de recorde.
- **Trocar o agregado pela tabela nova.** Rejeitado: exigiria migrar todo o histórico e reescrever as leituras existentes de uma vez.

## Consequências

- Uma escrita por série (mais uma atualização do agregado). Volume pequeno: um treino tem dezenas de séries.
- Desfazer uma série apaga a linha e recalcula o agregado; sem séries, o agregado é removido.
- O FitOS Livre (FIT-158) usa a mesma tabela e as mesmas funções.
