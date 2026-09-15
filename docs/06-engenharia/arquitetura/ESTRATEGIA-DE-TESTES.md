# Estratégia de testes

## Pirâmide

- unitários com Vitest para regras e transformações;
- integração para banco, módulos e adaptadores;
- contratos para API Ninjas, autenticação e cobrança;
- end-to-end com Playwright para jornadas críticas;
- smoke tests após deploy.

## Jornadas obrigatórias

1. personal cria conta e acessa tenant próprio;
2. personal convida aluno e o aluno acessa somente dados próprios;
3. tentativa cruzada entre dois tenants é rejeitada;
4. exercício é importado/normalizado e continua disponível após falha externa;
5. plano versionado é atribuído e executado;
6. cobrança do aluno muda apenas entre estados permitidos;
7. assinatura SaaS reage de forma idempotente a webhooks.

## Dados de teste

Somente dados sintéticos versionados. Sandboxes para provedores. Segredos por ambiente. Testes de isolamento usam no mínimo dois tenants, dois personais e alunos distintos.

## Gates de PR

Documentação: links, Markdown e ausência de segredos. Código futuro: lint, tipos, testes, build, revisão de segurança proporcional e evidência visual quando houver UI.
