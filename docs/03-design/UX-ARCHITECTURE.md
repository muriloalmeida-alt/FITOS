# Arquitetura de Experiência — FitOS

## Papéis

### Personal trainer

Gerencia carteira, prescreve, acompanha e cobra alunos. Busca eficiência e visão de risco.

### Aluno

Executa o plano, registra resultados e acompanha evolução. Busca simplicidade e motivação sem julgamento.

### Administrador de academia — futuro

Gerencia equipe, unidades, permissões, marca e indicadores agregados. Não deve aumentar a complexidade do MVP.

## Jobs to be Done

- Quando inicio um aluno, quero reunir informações e criar o primeiro treino rapidamente.
- Quando reviso minha semana, quero identificar quem precisa de atenção.
- Quando prescrevo, quero reutilizar estruturas sem perder personalização.
- Quando treino, quero registrar cada série com o mínimo de interação.
- Quando fecho o mês, quero saber o que foi pago e o que ainda precisa de cobrança.

## Arquitetura — personal

### MVP

1. Início
2. Alunos
   - Lista
   - Cadastro
   - Perfil
   - Avaliações
   - Progresso
3. Treinos
   - Programas
   - Modelos
   - Exercícios
   - Builder
4. Financeiro
   - Visão geral
   - Mensalidades
   - Recebimentos
   - Planos
5. Configurações

### Pós-MVP / futuro (hipótese sujeita à decisão de Produto)

- Agenda
- Relatórios
- Mensagens

## Arquitetura — aluno

### MVP

1. Hoje
2. Treino
   - Preparação
   - Execução
   - Conclusão
3. Progresso
4. Perfil

### Pós-MVP / futuro (hipótese sujeita à decisão de Produto)

- Mensagens

## Navegação adaptativa

| Largura | Personal | Aluno |
|---|---|---|
| Compact | Navigation bar + “Mais” | Navigation bar de 4 destinos |
| Medium | Navigation rail | Navigation rail ou bar |
| Expanded | Drawer persistente | Rail compacta |

## Jornada principal do personal

1. Adicionar aluno.
2. Enviar convite ou concluir cadastro assistido.
3. Registrar objetivo, restrições e disponibilidade.
4. Criar treino do zero ou a partir de um modelo. *(Criação assistida por IA é pós-MVP — ver Gate G5 em `docs/00-governanca/ROADMAP.md`.)*
5. Revisar exercícios e parâmetros.
6. Atribuir período e dias da semana.
7. Acompanhar execução e feedback.
8. Ajustar progressão.

## Jornada principal do aluno

1. Abrir “Hoje”.
2. Revisar treino e orientações.
3. Iniciar.
4. Registrar série.
5. Descansar com temporizador.
6. Avançar ou substituir exercício.
7. Concluir e informar percepção.
8. Ver progresso e próxima atividade.

## Modelo de atenção no dashboard

Ordem de prioridade:

1. Segurança ou restrição reportada.
2. Aluno inativo ou com baixa adesão.
3. Avaliação ou treino vencendo.
4. Pagamento atrasado.
5. Renovação próxima.
6. Evolução positiva a celebrar.

Cada item precisa responder: **o que aconteceu, com quem, desde quando e qual ação é possível**.

## Estados sistêmicos

Toda tela conectada a dados deve prever:

- Inicial/sem dados.
- Carregando com skeleton coerente.
- Conteúdo disponível.
- Resultado vazio após filtro.
- Falha recuperável com tentar novamente.
- Sem permissão.
- Falha de conexão, com nova tentativa disponível. *(O MVP não promete armazenamento nem sincronização offline.)*
- Sucesso com feedback não bloqueante.

## Conteúdo e linguagem

- Português do Brasil.
- Frases curtas e orientadas a tarefa.
- Não culpabilizar aluno por ausência ou atraso.
- Datas: `15 set 2026`; valores: `R$ 1.250,00`.
- Confirmações descrevem consequência antes da ação.
- Termos de treino devem ser consistentes: série, repetição, carga, descanso.

## Segurança de experiência

- O FitOS não diagnostica nem substitui decisão profissional.
- Alertas médicos e restrições aparecem próximos à prescrição.
- Quando a funcionalidade de IA for priorizada (pós-MVP), sugestões de IA devem ser revisadas pelo personal antes de qualquer publicação.
- Exclusões financeiras e alterações de histórico exigem confirmação e auditoria.

## Eventos essenciais de analytics

- `student_created`
- `student_invite_sent`
- `workout_builder_started`
- `workout_assigned`
- `workout_started`
- `set_logged`
- `exercise_substituted`
- `workout_completed`
- `payment_created`
- `payment_marked_paid`
- `attention_item_opened`

Eventos não devem registrar observações clínicas, mensagens ou dados sensíveis em texto livre.

> **Nota de escopo:** os eventos `ai_draft_requested` e `ai_draft_accepted`, presentes na versão original deste documento, foram retirados dos eventos atuais do MVP — pertencem à visão pós-MVP (Gate G5 em `docs/00-governanca/ROADMAP.md`) e serão redefinidos quando a funcionalidade de IA for priorizada por Produto.
