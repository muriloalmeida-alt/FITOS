# FitOS — Regras de Negócio

## 1. Organização e acesso

- Cada personal representa uma organização lógica independente.
- Todo aluno pertence a um personal no MVP.
- Um usuário aluno só consulta informações vinculadas ao seu próprio cadastro.
- Registros não podem ser acessados apenas pela posse de um identificador na URL.

## 2. Alunos

- Estados permitidos: `ativo`, `pausado` e `arquivado`.
- Aluno arquivado permanece no histórico e deixa de aparecer nas listas operacionais padrão.
- E-mail ou telefone duplicado deve gerar alerta, não associação automática.
- Restrições físicas e observações não geram recomendação automática.

## 3. Exercícios

- Origem: `api_ninjas` ou `personal`.
- O registro importado deve preservar origem e identificador interno de sincronização.
- O personal pode personalizar a apresentação para sua conta.
- Atualizações externas não devem apagar personalizações locais.
- Exercício inativo não pode ser adicionado a um novo treino, mas continua visível no histórico.

## 4. Modelos de treino

- Um modelo pode existir sem aluno associado.
- Cada item deve aceitar séries, repetições ou duração conforme o exercício.
- Campos de prescrição são independentes dos dados recebidos pela API externa.
- Duplicar um modelo cria uma nova entidade sem vínculo de atualização automática.

## 5. Planos atribuídos

- Um plano agrupa um ou mais treinos.
- A atribuição cria uma versão imutável da prescrição vigente naquele momento.
- Alterar o modelo original não altera planos já atribuídos.
- Mudanças em plano ativo geram uma nova versão, preservando o histórico.
- Um aluno pode ter apenas um plano principal ativo por vez no MVP.

## 6. Sessões

- Estados: `planejada`, `em_andamento`, `concluida` e `abandonada`.
- Uma sessão concluída registra data, duração e itens executados.
- O aluno pode informar valores executados diferentes dos prescritos.
- O histórico de execução não pode ser recalculado após mudança do plano.

## 7. Avaliações

- Toda avaliação deve registrar data e autor.
- Peso e medidas não podem aceitar valores negativos.
- Fotografias são opcionais e exigem autorização explícita do aluno.
- Exclusões de avaliações devem ser lógicas e auditáveis.

## 8. Financeiro

- Cobrança recorrente gera lançamentos independentes por competência.
- Estados: `pendente`, `pago`, `atrasado` e `cancelado`.
- Um lançamento pendente passa a atrasado após o vencimento.
- Pagamento exige data e valor recebido; pagamento parcial fica fora do MVP.
- Cancelamento exige motivo e não equivale a pagamento.
- Atraso financeiro não bloqueia automaticamente o acesso do aluno no MVP.
- Valores monetários devem ser armazenados sem ponto flutuante binário.

## 9. Auditoria

- Registrar autor, data e tipo de alteração em plano atribuído, avaliação e pagamento.
- Nunca registrar senhas, tokens, chaves ou conteúdo de credenciais nos logs.

## 10. Segurança e privacidade

- A chave da API Ninjas deve existir somente em ambiente seguro do servidor.
- Dados de uma conta jamais podem compor respostas de outra conta.
- Fotos e dados corporais devem ter acesso autenticado.
- Exportação ou exclusão de dados pessoais será detalhada antes da produção pública.
