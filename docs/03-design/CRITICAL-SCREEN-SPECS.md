# Especificação das Telas Críticas — FitOS

## 1. Dashboard do personal

### Objetivo

Responder em poucos segundos: “Como está meu negócio e quem precisa da minha atenção hoje?”

### Hierarquia

1. Saudação e contexto temporal.
2. Card “Atenção hoje”.
3. KPIs: alunos ativos, adesão semanal, receita prevista e recebida.
4. Agenda do dia.
5. Evolução da carteira.

### Ações

- Adicionar aluno.
- Criar treino.
- Abrir item de atenção.
- Ver agenda ou financeiro.

### Critérios de aceite

- Existe apenas um CTA primário por contexto.
- Cada KPI mostra período e definição.
- O usuário alcança um aluno sinalizado em até dois cliques.
- Loading não desloca o layout.
- Mobile prioriza atenção e agenda antes de gráficos.

## 2. Lista de alunos

### Conteúdo

- Busca por nome.
- Filtros por status, adesão, objetivo e plano.
- Visualização lista/tabela conforme breakpoint.
- Ação “Adicionar aluno”.

### Linha/card

Nome, foto opcional, objetivo, treino atual, última atividade, adesão, situação financeira e atenção.

### Critérios

- Filtros ativos permanecem visíveis.
- Resultado vazio diferencia “sem alunos” de “nenhum resultado”.
- Dados financeiros respeitam permissão.

## 3. Cadastro e perfil do aluno

### Etapas de cadastro

1. Dados essenciais.
2. Objetivo e experiência.
3. Restrições e disponibilidade.
4. Plano e cobrança.
5. Revisão e convite.

Solicitar apenas o necessário para começar; avaliações extensas podem ser concluídas depois.

### Perfil

Resumo, treinos, progresso, avaliações, financeiro, mensagens e histórico.

### Critérios

- Rascunho automático.
- Dados sensíveis com acesso controlado.
- Restrições visíveis antes de prescrever.

## 4. Biblioteca de exercícios

### Fonte

Consumir API-Ninjas por camada interna, com cache e normalização. A UI não deve depender da nomenclatura bruta da API.

### Recursos

- Busca.
- Filtros: músculo, equipamento, tipo e dificuldade.
- Preview de execução.
- Favoritos e recentes.
- Exercício próprio.

### Critérios

- Fonte e disponibilidade do conteúdo conhecidas.
- Estado de mídia ausente previsto.
- Tradução e taxonomia consistentes.
- Erro externo não impede acesso a itens salvos/cacheados.

## 5. Builder de treino

### Estrutura

- Cabeçalho: nome, objetivo, aluno/modelo, salvar e publicar.
- Painel de exercícios com busca e filtros.
- Canvas ordenável.
- Parâmetros por exercício.
- Visão geral da semana.

### Parâmetros

Séries, repetições ou duração, carga, descanso, RPE/RIR opcional, observação e vídeo.

### Regras

- Autosave com estado “Salvando/Salvo/Erro”.
- Duplicar exercício ou sessão.
- Desfazer após remoção.
- Alertar conflito com restrição cadastrada.
- IA inicia rascunho, nunca publica automaticamente. *(Recurso de IA é pós-MVP — ver nota de escopo em `COMPONENT-LIBRARY.md`.)*

## 6. Treino em execução — aluno

### Hierarquia

1. Exercício e orientação.
2. Série atual.
3. Carga e repetições.
4. Concluir série.
5. Descanso.
6. Próximo exercício.

### Regras mobile

- Operação com uma mão.
- Teclado numérico para valores.
- Repetir último valor em um toque.
- Estado preservado ao bloquear a tela ou trocar de app.
- Sincronização posterior quando offline.

### Critérios

- Nenhuma ação crítica perto de “Concluir série”.
- Alvos mínimos de 48 dp.
- Temporizador acessível e não bloqueante.
- Conclusão mostra resumo e feedback simples.

## 7. Financeiro

### Visão geral

Receita prevista, recebida, atrasada, próximos vencimentos e evolução mensal.

### Lista de recebimentos

Aluno, plano, competência, vencimento, valor, estado e forma de pagamento.

### Critérios

- Valores usam algarismos tabulares.
- Filtro de competência explícito.
- Baixa manual registra autor, data e observação.
- Cancelamento/estorno exige confirmação.
- “Atrasado” não usa linguagem constrangedora em comunicações ao aluno.

## 8. Estados transversais

Cada tela deve especificar: skeleton, vazio inicial, vazio por filtro, erro, offline, sem permissão, sucesso e conteúdo extremo.

## 9. Responsividade

Validar obrigatoriamente em 360, 768, 1024 e 1440 px. A adaptação prioriza tarefa; não consiste apenas em empilhar colunas.
