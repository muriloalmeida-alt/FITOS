# Evidências — FIT-137 (correção grande pós-validação real, pacote visual 2026)

Murilo mandou 5 capturas reais de `hml-fitos.up.railway.app` (Personal autenticado). Meu primeiro julgamento (PR #181/FIT-136) tratou só `/painel/exercicios`. Ao pedir para "comparar todas as telas" e "revisar todas as telas", uma comparação sistemática de código contra os 11 prints do pacote (`01-CONTRATO-VISUAL-E-ROTAS.md`) revelou lacunas reais, muito maiores em Aluno e FitOS Livre do que em Exercícios.

## Metodologia

Para cada uma das 11 telas de referência, abri o print (`prints-mobile/tela-XX.png`) e o código do componente/rota mapeada na tabela de `01-CONTRATO-VISUAL-E-ROTAS.md`, e comparei composição (não só se a rota "funciona"). Resultado por tela:

| Tela | Rota(s) | Resultado |
| --- | --- | --- |
| 01 | `/entrar` | Confere (verificado com captura própria, FIT-132) |
| 02 | `/conheca` | Confere (contraste corrigido no PR5/FIT-135) |
| 03 | `/comecar` | Confere |
| 04 | `/onboarding-personal` | Gap já documentado desde o PR2 (hero só desktop, seletor "quantos alunos" é dropdown) — fora do escopo desta correção |
| 05 | Seleção de planos | Confere (divergências documentadas e corretas: "Selecionado" real em vez de "mais escolhido" fabricado) |
| 06 | `/painel` (Personal) | **Corrigido nesta PR** — métricas reais estavam num card separado, não sobrepostas ao hero como o print mostra |
| 07 | `/painel/alunos` | **Corrigido nesta PR** — faltava o cartão de destaque, a barra de progresso por aluno e o rótulo "Abrir perfil" |
| 08 | `/painel/treinos` + `/painel/exercicios` | Corrigido no PR #181 (FIT-136); revisado de novo aqui, sem mudança adicional |
| 09 | `/painel` (Aluno) | **Corrigido nesta PR** — faltava inteiramente "Seu ritmo nesta semana" |
| 10 | `/painel` (FitOS Livre) | **Corrigido nesta PR — o maior gap.** O estado padrão (sem sessão em andamento, o mais comum) não tinha hero, CTA, "Sua evolução" nem "Seu plano" — só um card de perfil que não existe no print |
| 11 | `/painel/financeiro` + `/painel/assinatura` | Confere (confirmado pelas suas próprias capturas reais) |

## O que foi corrigido

### Dado novo, 100% real: ritmo semanal (`getWeeklyRhythmForStudent`, `src/modules/workouts/workouts.ts`)

Nova consulta: dias distintos (segunda a domingo) com `WorkoutSession.status = CONCLUIDA` nesta semana — nunca um número do print. `targetDays` deriva da união dos `suggestedDays` reais dos modelos do plano atualmente atribuído (`null` quando não há plano ativo — sempre o caso do workspace individual, que não tem esse conceito). Coberta por 3 testes de integração reais (Postgres): contagem de dias distintos ignorando sessões não concluídas/de outra semana, `targetDays` correto a partir do plano, isolamento entre tenants.

### Tela 09 — `AlunoHome.tsx`

Seção "Seu ritmo nesta semana" (barra `WeeklyRhythmBar`, novo componente compartilhado) — só aparece com meta real (`targetDays !== null`, ou seja, com plano ativo configurado). Sem plano ativo, a seção simplesmente não aparece — nunca uma barra fabricada.

### Tela 10 — `IndividualHome.tsx` (reescrito)

O PR anterior (FIT-134) só tratava o estado "sessão em andamento". Agora, três estados reais e explícitos:

1. **Sem treino nenhum ainda**: hero convida a criar o primeiro (`Criar meu primeiro treino` → `/painel/meus-treinos/novo`) — nunca finge que há algo para começar.
2. **Com treino real sugerido, sem sessão em andamento**: hero motivacional ("Treine no seu próprio ritmo.") com CTA que leva direto ao primeiro treino real do praticante (`listWorkoutsForTenant`, já ordenado por nome — nunca aleatório); "Hoje para você" mostra o preview real (nome, contagem real de exercícios via `listWorkoutExercisesForWorkout`, link "Ver treino").
3. **Com sessão em andamento**: hero "Continuar treino" (comportamento já existente da FIT-134) — "Hoje para você" não aparece, para não duplicar o mesmo treino.

"Sua evolução" (`WeeklyRhythmDots`, 7 pontos reais desta semana) sempre visível, mesmo em zero. "Seu plano" só aparece com assinatura real (`getSubscriptionForTenant`) — mostra o período de trial real (`trialEndsAt`) quando ainda ativo, senão só o preço mensal real.

### Tela 07 — `/painel/alunos` + `StudentCard`

Cartão de destaque "Convidar ou cadastrar aluno" (novo, leva à rota real `/painel/alunos/novo`, que já cobre cadastro e convite desde a FIT-015). `StudentCard` ganha a barra de ritmo semanal real por aluno (só quando há meta real — inativos/vínculo encerrado não mostram barra) e o rótulo visível "Abrir perfil →" (antes o cartão inteiro era clicável sem nenhuma affordance de texto).

### Tela 06 — `/painel` (Personal), `PersonalHero.tsx`

Duas mudanças reais:
- Saudação personalizada real por hora do servidor ("Bom dia/Boa tarde/Boa noite, {nome}.") em vez do texto genérico fixo — calculada no servidor (`page.tsx`, `now.getHours()`), nunca no cliente, para não divergir entre o HTML enviado e a hidratação.
- As métricas reais (alunos ativos, treinos ativos) passam a ficar sobrepostas na própria foto, como o print mostra — **duplicando** o que já aparece em "Visão geral" abaixo (mesmo padrão já aceito em `FinanceiroHero`/FIT-133, que duplica "Recebido"). A "76% treinos concluídos" do print **não foi reproduzida**: o próprio contrato (`01-CONTRATO-VISUAL-E-ROTAS.md`, linha da tela 06) diz explicitamente que esse número é fictício e que não se deve "derivar estatísticas sem fonte confiável" — não existe uma definição real e não-ambígua de "% de treinos concluídos" agregada por personal neste momento, então a segunda métrica é "treinos ativos" (já real, já existia em "Visão geral").

## Testes

- `getWeeklyRhythmForStudent`: 3 testes de integração novos (Postgres real) em `workouts.integration.test.ts`.
- `AlunoHome.test.tsx`: 2 testes novos (com/sem meta real).
- `IndividualHome.test.tsx`: **novo arquivo** (não existia nenhum teste para este componente antes) — 6 testes cobrindo os três estados do hero, "Hoje para você", "Sua evolução" e "Seu plano" (com/sem trial ativo).
- `StudentCard.test.tsx`: 4 testes novos (rótulo "Abrir perfil", com/sem barra de ritmo).
- `alunos/page.test.tsx`: 1 teste novo (cartão de destaque + ritmo real por aluno).
- `PersonalHero.test.tsx`: reescrito para as novas props (saudação real, métricas reais, singular/plural correto).
- `PersonalHome.test.tsx`/`page.test.tsx`: ajustados para os números que agora aparecem duas vezes (hero + Visão geral) e para os novos mocks (`getWeeklyRhythmForStudent`, `getSubscriptionForTenant`, `listWorkoutExercisesForWorkout`).
- Suíte completa: 815/815 testes de unidade/componente (23 novos desde o PR #181), sem regressão. `tsc --noEmit`/`eslint .`/`next build`/`npm audit --omit=dev` limpos.

## Pendência explícita

Sem captura real desta correção — todas as rotas envolvidas são autenticadas (Personal, Aluno, FitOS Livre), sem PostgreSQL/Docker neste sandbox de execução. Depende de Murilo confirmar em homologação depois do merge — e desta vez, à luz do que já aconteceu, a confirmação deve ser tela a tela contra os prints mapeados, não uma checagem geral.
