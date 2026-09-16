# FitOS — Backlog Inicial do MVP

Prioridades: `P0` essencial, `P1` importante, `P2` posterior.

## Épico 1 — Fundação e acesso

**Implementado pela EPIC-03 — Identidade, Acesso e Navegação (#21), SPRINT-04.** Os critérios abaixo, escritos como backlog especulativo antes da prova técnica de autenticação, foram cobertos pelas Histórias formais FIT-009 (#22, cadastro/login/logout/sessão do personal), FIT-010 (#23, provisionamento do tenant), FIT-011 (#24, isolamento e autorização por sessão) e FIT-012 (#25, shell autenticado de personal e aluno). Os identificadores FIT-001 e FIT-002 abaixo permanecem apenas como registro histórico do backlog original — não foram promovidos a Issues nem reutilizados.

### FIT-001 — Estruturar conta do personal (`P0`)

Como personal, quero acessar uma área isolada para administrar minha carteira.

Critérios:
- Conta autenticada identifica o personal.
- Dados de outro personal não são acessíveis.
- Sessão pode ser encerrada com segurança.

### FIT-002 — Disponibilizar acesso do aluno (`P0`)

Como aluno, quero consultar somente meus dados e treinos.

Critérios:
- Convite vincula o acesso ao cadastro correto.
- Aluno não acessa área administrativa.
- Aluno não consulta dados de outros alunos.

## Épico 2 — Alunos

> Nota de renumeração: os itens abaixo eram originalmente FIT-010, FIT-011 e FIT-012 neste backlog especulativo. Esses identificadores foram formalmente ocupados pela EPIC-03/SPRINT-04 (Issues reais #23, #24 e #25, sobre provisionamento de tenant, autorização e shell autenticado — assunto não relacionado à gestão de alunos). Como os itens abaixo nunca foram promovidos a Issue, foram renumerados para FIT-013, FIT-014 e FIT-015 para eliminar a colisão, preservando a ordem e o conteúdo originais.

### FIT-013 — Cadastrar e editar aluno (`P0`)

Critérios:
- Campos essenciais são validados.
- Objetivo, restrições e observações podem ser registrados.
- Cadastro aparece na lista após sucesso.

### FIT-014 — Consultar perfil completo (`P0`)

Critérios:
- Perfil reúne dados, plano atual, evolução e financeiro.
- Ausência de informações possui estado vazio orientativo.

### FIT-015 — Pausar ou arquivar aluno (`P1`)

Critérios:
- Histórico é preservado.
- Listas padrão distinguem alunos ativos.

## Épico 3 — Exercícios

### FIT-020 — Integrar pesquisa da API Ninjas (`P0`)

Critérios:
- Chamada ocorre no backend.
- Chave não é exposta.
- Filtros suportados são encaminhados corretamente.
- Falhas e limites recebem tratamento amigável.

### FIT-021 — Importar e normalizar exercício (`P0`)

Critérios:
- Origem e conteúdo original são preservados.
- Seleção fica disponível no catálogo local.
- Importações repetidas não criam duplicidades óbvias.

### FIT-022 — Cadastrar exercício próprio (`P0`)

Critérios:
- Personal informa nome, tipo, músculo, equipamento e instruções.
- Exercício fica restrito à conta do personal.

## Épico 4 — Treinos e planos

### FIT-030 — Criar modelo de treino (`P0`)

Critérios:
- Personal adiciona, remove e ordena exercícios.
- Cada item aceita parâmetros de prescrição.
- Modelo pode ser salvo e editado.

### FIT-031 — Duplicar modelo (`P1`)

Critérios:
- Cópia é independente do original.
- Nome indica que se trata de cópia até ser editado.

### FIT-032 — Criar plano semanal (`P0`)

Critérios:
- Plano agrupa treinos.
- Personal define dias sugeridos e vigência.

### FIT-033 — Atribuir plano ao aluno (`P0`)

Critérios:
- A atribuição preserva a versão atual.
- Plano anterior pode ser encerrado.
- Aluno passa a visualizar o plano atribuído.

## Épico 5 — Execução e evolução

### FIT-040 — Exibir treino do aluno (`P0`)

Critérios:
- Exercícios aparecem na ordem prescrita.
- Instruções e parâmetros são legíveis no celular.

### FIT-041 — Registrar sessão (`P0`)

Critérios:
- Aluno registra resultados executados.
- Sessão pode ser concluída ou abandonada.
- Histórico mantém o plano vigente naquela execução.

### FIT-042 — Registrar avaliação (`P1`)

Critérios:
- Personal cadastra peso, medidas e observações.
- Evolução pode ser consultada cronologicamente.

## Épico 6 — Financeiro

### FIT-050 — Cadastrar cobrança (`P0`)

Critérios:
- Personal informa aluno, descrição, valor, competência e vencimento.
- Lançamento inicia como pendente quando aplicável.

### FIT-051 — Registrar pagamento (`P0`)

Critérios:
- Data e valor recebido são obrigatórios.
- Cobrança passa a paga e mantém histórico.

### FIT-052 — Gerar mensalidades recorrentes (`P1`)

Critérios:
- Recorrência gera lançamentos independentes.
- Alteração futura não modifica competências anteriores.

### FIT-053 — Exibir resumo financeiro (`P0`)

Critérios:
- Exibe previsto, recebido, pendente e atrasado.
- Permite identificar lançamentos que exigem ação.

## Épico 7 — Painel inicial

### FIT-060 — Consolidar visão operacional (`P1`)

Critérios:
- Exibe alunos ativos, treinos e situação financeira.
- Atalhos levam diretamente às ações principais.

## Ordem sugerida de entrega

1. FIT-001, FIT-013 e FIT-014.
2. FIT-020, FIT-021 e FIT-022.
3. FIT-030, FIT-032 e FIT-033.
4. FIT-002, FIT-040 e FIT-041.
5. FIT-050, FIT-051 e FIT-053.
6. FIT-015, FIT-031, FIT-042, FIT-052 e FIT-060.
