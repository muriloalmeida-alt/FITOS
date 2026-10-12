# Painel inicial do aluno (proposta 9, aprovada em 11/10/2026)

O painel vale para o aluno com personal e para o FitOS Livre. Cada um mantém o próprio rodapé.

## Ordem da tela

1. Data, "Olá, [primeiro nome]!" e a mensagem ("Seu próximo treino começa aqui." ou "Seu treino está em andamento.").
2. **Sua semana:** segunda a domingo no fuso de Brasília, com a faixa de datas e os dias numerados.
   - Dia com treino concluído mostra ✓.
   - Dia previsto tem contorno.
   - Hoje tem anel e o nome do dia destacado.
   - A legenda diz o que é hoje.
3. **Iniciar treino:** abre "Como deseja treinar?" sem iniciar nada.
   - **Treino programado:** o treino do dia. Em dia livre, o programa (aluno) ou o treino sugerido (Livre). Sem programa, a orientação.
   - **Treino avulso:** só no Livre, onde o fluxo existe. A escolha fecha e abre o foco do avulso, uma modal de cada vez.
   - **Treino realizado:** o registro retroativo, com `FEATURE_RETROATIVO`.
   - Com sessão em andamento, o botão vira **Continuar treino** e retoma a mesma sessão.
4. **Sua evolução:** treinos concluídos na semana e no mês contra a meta, com barra (até 100%) e percentual arredondado (pode passar de 100%).
5. **Avisos:** pagamento, próxima aula, ficha de saúde, peso, teste grátis e progressão, depois da evolução.

## Contagem e meta

- **Contagem:** sessões concluídas (ao vivo, avulsas e retroativas), uma vez cada, pela data de realização. Em andamento e abandonadas não contam.
- **Meta:** os dias de treino escolhidos pelo aluno ("meus dias"), contados no período. Sem "meus dias", valem os dias do programa (aluno) ou dos treinos (Livre).
- **Sem dias configurados:** a semana usa a frequência já escolhida; o mês mostra "Meta não definida". Nunca se supõe 3 por semana nem semana × 4.

## Botão +

O "Começar treino" do aluno com personal abre esta mesma escolha (`/painel?iniciar=1`). O Livre mantém os atalhos aprovados na proposta 7.

## Arquivos

- `src/shared/lib/panel.ts`: semana e metas (com testes).
- `src/modules/students/panelData.ts`: leitura dos dados.
- `src/app/painel/_panel/`: tela e escolha de como treinar.
- `AlunoHome.tsx` e `IndividualHome.tsx`: o painel de cada perfil.
