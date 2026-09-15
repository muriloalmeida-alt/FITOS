# PRD 01 — FitOS MVP

Versão: 1.0  
Status: pronto para refinamento técnico

## 1. Problema

Personal trainers frequentemente distribuem sua operação entre mensagens, planilhas, aplicativos de treino e controles financeiros separados. Isso aumenta retrabalho, dificulta a visão sobre cada aluno e torna cobranças e vencimentos fáceis de esquecer.

## 2. Proposta

Oferecer um painel web responsivo em que o personal consiga cadastrar alunos, organizar exercícios, montar e atribuir planos de treino, acompanhar a evolução e controlar mensalidades.

## 3. Público inicial

Personal trainer autônomo que atende presencialmente, remotamente ou de forma híbrida e administra a própria carteira de alunos.

### Usuário secundário

Aluno convidado pelo personal, com acesso apenas ao próprio plano, registros, avaliações e situação financeira aplicável.

## 4. Objetivos do MVP

- Centralizar a carteira de alunos.
- Reduzir o tempo de criação e manutenção de treinos.
- Permitir acompanhamento simples da execução e evolução.
- Dar visibilidade de mensalidades a vencer, pagas e atrasadas.
- Validar uso recorrente por personal trainers antes de ampliar o produto.

## 5. Jornada principal do personal

1. Acessar sua conta.
2. Cadastrar um aluno.
3. Consultar ou cadastrar exercícios.
4. Criar um modelo de treino com exercícios e parâmetros.
5. Criar um plano e atribuí-lo ao aluno.
6. Consultar adesão, registros e evolução.
7. Cadastrar uma mensalidade e acompanhar seu status.

## 6. Escopo funcional

### 6.1 Painel inicial

- Total de alunos ativos.
- Treinos previstos e concluídos no período.
- Mensalidades a vencer e atrasadas.
- Atalhos para novo aluno, novo treino e novo lançamento.
- Lista de pendências que exijam ação do personal.

### 6.2 Alunos

- Cadastro com nome, contato, data de nascimento, objetivo, observações e status.
- Questionário inicial e restrições informadas pelo aluno.
- Histórico de avaliações, planos e situação financeira.
- Arquivamento sem exclusão do histórico.

### 6.3 Exercícios

- Pesquisa no catálogo importado da API Ninjas.
- Filtros por nome, grupo muscular, tipo, dificuldade e equipamento.
- Cadastro de exercício próprio.
- Tradução ou edição dos textos exibidos, sem sobrescrever silenciosamente a fonte original.
- Status ativo/inativo no catálogo interno.

### 6.4 Treinos e planos

- Criação de modelos reutilizáveis de treino.
- Inclusão e ordenação de exercícios.
- Configuração de séries, repetições ou duração, carga sugerida, descanso, cadência e observação.
- Duplicação de modelo.
- Composição de um plano com um ou mais treinos.
- Atribuição do plano ao aluno com vigência e dias sugeridos.
- Preservação de versão do plano atribuído.

### 6.5 Execução e evolução

- Aluno visualiza o treino do dia.
- Registro de exercício concluído, carga, repetições e observação.
- Conclusão ou abandono de uma sessão.
- Histórico por aluno.
- Avaliações manuais com peso, medidas corporais, percentual de gordura opcional, fotos opcionais e observações.

### 6.6 Financeiro

- Cadastro de cobrança avulsa ou recorrente.
- Valor, competência, vencimento, descrição e método de pagamento informado.
- Estados: pendente, pago, atrasado e cancelado.
- Registro manual do pagamento.
- Resumo mensal de previsto, recebido, vencido e inadimplência.
- Nenhuma movimentação bancária ou cobrança automática no MVP.

### 6.7 Acesso

- Conta do personal isolada das demais contas.
- Aluno acessa somente dados próprios vinculados ao personal.
- Perfis mínimos: personal e aluno.
- Recuperação de acesso.

## 7. Requisitos não funcionais

- Interface responsiva com prioridade para celular.
- Operações comuns devem exigir poucos passos.
- Segredos apenas no servidor.
- Proteção contra acesso entre contas distintas.
- Datas, moeda e textos adequados ao Brasil.
- Registro de alterações críticas em planos, avaliações e pagamentos.
- Estados de carregamento, vazio, sucesso e erro nas jornadas principais.

## 8. Indicadores iniciais

- Percentual de contas que cadastram o primeiro aluno.
- Tempo até criar e atribuir o primeiro plano.
- Personal trainers ativos por semana.
- Alunos com ao menos uma sessão registrada por semana.
- Percentual de cobranças atualizadas no mês.
- Retenção do personal após quatro semanas.

## 9. Critério de sucesso do MVP

Um personal deve conseguir cadastrar um aluno, montar um plano com exercícios, atribuí-lo, acompanhar ao menos uma execução e registrar uma mensalidade sem usar outra ferramenta para completar essas tarefas.

## 10. Dependências e riscos

- API Ninjas: limites, disponibilidade, idioma e licença comercial.
- Dados sensíveis: necessidade de privacidade, consentimento e controle de acesso.
- Escopo financeiro: evitar que controle interno seja apresentado como contabilidade formal.
- Conteúdo de exercícios: orientações externas não substituem avaliação profissional.
