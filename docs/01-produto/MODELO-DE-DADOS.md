# FitOS — Modelo Conceitual de Dados

Este documento define conceitos de produto. A Engenharia decidirá nomes físicos, tipos e estratégia de persistência.

## Entidades principais

| Entidade | Finalidade | Campos essenciais |
|---|---|---|
| Usuário | Identidade de acesso | nome, e-mail, perfil, status |
| Personal | Conta profissional | usuário, dados profissionais, preferências |
| Aluno | Pessoa acompanhada | personal, usuário opcional, contato, objetivo, status |
| Questionário | Informações iniciais | aluno, respostas, data, autor |
| Exercício | Catálogo normalizado | origem, nome, tipo, músculo, dificuldade, equipamentos, instruções, segurança |
| Personalização de exercício | Variação criada pelo personal | personal, exercício-base, nome e instruções locais |
| Modelo de treino | Estrutura reutilizável | personal, nome, objetivo, status |
| Item de treino | Prescrição de um exercício | modelo, exercício, ordem, séries, repetições, duração, carga, descanso, cadência |
| Plano | Programação atribuível | personal, nome e composição semanal |
| Plano atribuído | Versão destinada ao aluno | aluno, plano, versão, vigência, status |
| Sessão | Instância executável | aluno, plano atribuído, treino, data, status |
| Item executado | Resultado por exercício | sessão, item prescrito, carga, repetições, duração, status |
| Avaliação | Marco de evolução | aluno, data, peso, gordura opcional, observações |
| Medida corporal | Medida vinculada à avaliação | avaliação, tipo, valor, unidade |
| Foto de evolução | Imagem protegida | avaliação, referência do arquivo, consentimento |
| Cobrança | Valor devido | aluno, competência, vencimento, valor, estado |
| Pagamento | Quitação de cobrança | cobrança, data, valor, método informado |
| Evento de auditoria | Rastreabilidade | autor, entidade, ação, data, metadados seguros |

## Relacionamentos

- Personal possui muitos alunos, exercícios personalizados, modelos, planos e cobranças.
- Aluno possui questionários, planos atribuídos, sessões, avaliações e cobranças.
- Modelo de treino possui muitos itens ordenados.
- Plano possui um ou mais modelos de treino organizados por programação.
- Plano atribuído preserva uma versão da prescrição.
- Sessão registra a execução de um treino dessa versão.
- Cobrança pode possuir zero ou um pagamento no MVP.

## Restrições conceituais

- Todas as entidades operacionais devem carregar o contexto da conta do personal direta ou indiretamente.
- Histórico atribuído ou executado deve ser preservado por versão ou snapshot.
- Arquivamento é preferível à remoção física de entidades referenciadas.
- Valores financeiros usam unidade monetária exata.
- Datas de competência e vencimento têm significados distintos.
