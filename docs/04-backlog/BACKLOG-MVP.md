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

**Parcialmente implementado pela EPIC-04 — Cadastro e Relacionamento com Alunos, SPRINT-05.** As Histórias formais FIT-013 (cadastro/listagem), FIT-014 (perfil e ciclo de vida) e FIT-015 (convite e ativação — não previsto originalmente aqui, mas necessário para que o aluno tenha acesso real) cobrem cadastro, edição de dados básicos, busca/listagem e inativação/reativação. Os critérios especulativos abaixo que citam plano atual, evolução ou financeiro no perfil **não** são cobertos pela SPRINT-05 — dependem dos Épicos de Treinos (4), Execução (5) e Financeiro (6), ainda não iniciados. Os identificadores FIT-017, FIT-018 e FIT-019 abaixo permanecem apenas como registro histórico do backlog original — não foram promovidos a Issues nem reutilizados.

> Nota de renumeração: os itens abaixo eram FIT-013, FIT-014 e FIT-015 neste backlog especulativo (eles próprios já eram uma renumeração de um FIT-010/011/012 anterior — ver histórico no controle de versão). Esses identificadores foram formalmente ocupados pela EPIC-04/SPRINT-05 (Issues reais, sobre a implementação de verdade de cadastro, perfil e convite de alunos — o mesmo assunto deste Épico especulativo, agora executado). Como os itens abaixo nunca foram promovidos a Issue, foram renumerados para FIT-017, FIT-018 e FIT-019 para eliminar a colisão, preservando a ordem e o conteúdo originais.

### FIT-017 — Cadastrar e editar aluno (`P0`)

Critérios:
- Campos essenciais são validados.
- Objetivo, restrições e observações podem ser registrados.
- Cadastro aparece na lista após sucesso.

### FIT-018 — Consultar perfil completo (`P0`)

Critérios:
- Perfil reúne dados, plano atual, evolução e financeiro.
- Ausência de informações possui estado vazio orientativo.

### FIT-019 — Pausar ou arquivar aluno (`P1`)

Critérios:
- Histórico é preservado.
- Listas padrão distinguem alunos ativos.

## Épico 3 — Exercícios

**Implementado pela EPIC-05 — Exercícios e Catálogo (#41), SPRINT-06.** As Histórias formais FIT-020 (integração e prova técnica da API Ninjas), FIT-021 (importação e persistência do catálogo global) e FIT-022 (gestão de exercícios próprios) cobrem o mesmo tema geral deste Épico especulativo — mais precisamente: FIT-020 isola a integração externa e sua prova técnica (a chamada nunca no frontend, chave nunca exposta, filtros e limites tratados); FIT-021 cobre importação/normalização/deduplicação; FIT-022 cobre o cadastro próprio. Uma quarta História real, FIT-023 (catálogo unificado, busca e detalhes), não tinha equivalente especulativo aqui — cobre a listagem/busca/filtro/paginação que une catálogo global e próprio, algo que este backlog original não havia detalhado como item separado. Os identificadores FIT-020, FIT-021 e FIT-022 abaixo permanecem apenas como registro histórico do backlog original — não foram promovidos a Issues nem reutilizados.

> Nota de renumeração: os itens abaixo ocupavam FIT-020, FIT-021 e FIT-022 neste backlog especulativo. Esses identificadores foram formalmente ocupados pela EPIC-05/SPRINT-06 (Issues reais #42/#43/#44, sobre a implementação de verdade de integração, importação e exercícios próprios — o mesmo assunto deste Épico especulativo, agora executado). Como os itens abaixo nunca foram promovidos a Issue, foram renumerados para FIT-024, FIT-025 e FIT-026 para eliminar a colisão, preservando a ordem e o conteúdo originais.

### FIT-024 — Integrar pesquisa da API Ninjas (`P0`)

Critérios:
- Chamada ocorre no backend.
- Chave não é exposta.
- Filtros suportados são encaminhados corretamente.
- Falhas e limites recebem tratamento amigável.

### FIT-025 — Importar e normalizar exercício (`P0`)

Critérios:
- Origem e conteúdo original são preservados.
- Seleção fica disponível no catálogo local.
- Importações repetidas não criam duplicidades óbvias.

### FIT-026 — Cadastrar exercício próprio (`P0`)

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

1. FIT-001, FIT-017 e FIT-018 (histórico especulativo — ver nota da Épico 2; execução real foi FIT-013/014/015/016, EPIC-04/SPRINT-05).
2. FIT-024, FIT-025 e FIT-026 (histórico especulativo — ver nota da Épico 3; execução real foi FIT-020/021/022/023, EPIC-05/SPRINT-06).
3. FIT-030, FIT-032 e FIT-033.
4. FIT-002, FIT-040 e FIT-041.
5. FIT-050, FIT-051 e FIT-053.
6. FIT-019, FIT-031, FIT-042, FIT-052 e FIT-060.
