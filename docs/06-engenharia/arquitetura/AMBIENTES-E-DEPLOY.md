# Ambientes e deploy

## Plataforma

Railway hospeda aplicação e PostgreSQL. ADR-001 registra a decisão.

## Ambientes

| Ambiente | Uso | Dados |
|---|---|---|
| Desenvolvimento | trabalho local | sintéticos |
| Homologação | validação integrada | fictícios/anonimizados |
| Produção | usuários reais | reais e protegidos |

Cada ambiente possui banco, URLs, chaves e integrações separados. Credencial de produção não pode existir em desenvolvimento ou homologação.

## Topologia Railway (FIT-008)

- Projeto: `FitOS` (project ID `d721a8fb-db7f-43f2-a994-b1df66cb8dd9`).
- Ambiente de homologação: environment ID `3f809456-55b0-4eba-b7a2-f91b53e69bcb` — criado inicialmente com o nome padrão `production` do Railway; a FIT-008 renomeia esse ambiente para `homologacao`, preservando o environment ID, para que o nome reflita seu uso real (não há produção funcional nesta História).
- Serviço web: `fitos-web-hml` (service ID `2e6422fe-9a17-4e5c-8049-02ac705bc50b`), Next.js, healthcheck em `/api/health`.
- Serviço de banco: `fitos-postgres-hml`, PostgreSQL persistente, exclusivo do ambiente de homologação.
- `DATABASE_URL` do serviço web referencia o serviço de banco pela variável gerada pelo próprio Railway (`${{fitos-postgres-hml.DATABASE_URL}}`), nunca uma string de conexão fixa em configuração versionada.
- Pré-deploy: `npm run db:migrate:deploy` (aplica migrations de forma não destrutiva antes de cada deploy), configurado como código em `railway.json` (`deploy.preDeployCommand`) — rastreável no repositório, não apenas na configuração manual do serviço.
- Variáveis já configuradas no serviço web: `NEXT_PUBLIC_APP_NAME=FitOS`, `NEXT_PUBLIC_APP_ENV=homologacao`, `NODE_ENV=production`.
- Sem seed automático em homologação — apenas as migrations são aplicadas no pré-deploy; dados de exemplo, se necessários, são inseridos manualmente e de forma exclusivamente sintética.

Detalhes de execução, incluindo o que foi efetivamente aplicado nesta rodada e o que ficou pendente por falta de acesso ao Railway CLI/API neste ambiente de execução, estão em `docs/06-engenharia/evidencias/FIT-008/DEPLOY-HOMOLOGACAO.md`.

## Pipeline proposto

1. branch por História;
2. lint, tipos, testes unitários e build;
3. PR e revisão obrigatória;
4. homologação controlada;
5. merge autorizado;
6. deploy de produção rastreável ao SHA;
7. smoke test e monitoramento;
8. rollback se critérios falharem.

Não há deploy direto de branch de desenvolvimento para produção. Migrations destrutivas exigem estratégia expand/contract, backup e plano de reversão.

## Pendências antes do provisionamento de produção

- disponibilidade e retenção de backups do PostgreSQL de homologação (Railway oferece backup gerenciado pago; decisão de habilitar ou não permanece pendente — ver `DEPLOY-HOMOLOGACAO.md`);
- política de migrations para produção (homologação usa `prisma migrate deploy` no pré-deploy; produção ainda não existe nesta Sprint);
- domínio e URLs de produção;
- orçamento e alertas de consumo;
- processo de rollback e recuperação testado em produção (homologação documenta rollback de deploy via Railway; produção seguirá o mesmo princípio quando existir).
