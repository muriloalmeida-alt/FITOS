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
- Ambiente de homologação: environment ID `8a742a2f-f84a-4222-887f-5684c12fbc79`, nome `homologacao` — criado como ambiente novo e separado (não é o `production` original renomeado; o Railway não permitiu ou não foi utilizada a renomeação direta). O ambiente `production` original (environment ID `3f809456-55b0-4eba-b7a2-f91b53e69bcb`) permanece existindo, inalterado, sem nenhuma produção funcional configurada.
- Serviço web: `fitos-web-hml` (service ID `2e6422fe-9a17-4e5c-8049-02ac705bc50b`), Next.js, healthcheck em `/api/health`, deploy ativo do commit `071ba1e91c24702c44d488cae2b554741d194cc0` (deployment `1c5a6a50-9369-46d3-b888-c286d8a70337`), URL pública `https://fitos-web-hml-homologacao.up.railway.app`.
- Serviço de banco: `fitos-postgres-hml` (service ID `b3567d92-b727-466c-ba64-9ecfc7698f4a`), PostgreSQL 18 persistente (imagem `ghcr.io/railwayapp-templates/postgres-ssl:18`), volume de 5 GB, região `sfo`, exclusivo do ambiente de homologação.
- `DATABASE_URL` do serviço web referencia o serviço de banco pela variável gerada pelo próprio Railway (`${{fitos-postgres-hml.<VARIÁVEL>}}`), nunca uma string de conexão fixa em configuração versionada.
- Pré-deploy: `npm run db:migrate:deploy` (aplica migrations de forma não destrutiva antes de cada deploy), configurado como código em `railway.json` (`deploy.preDeployCommand`). Builder efetivo observado: Railpack (divergência não bloqueante frente ao `NIXPACKS` declarado em `railway.json` — ver `DEPLOY-HOMOLOGACAO.md`).
- Variáveis já configuradas no serviço web: `NEXT_PUBLIC_APP_NAME=FitOS`, `NEXT_PUBLIC_APP_ENV=homologacao`, `NODE_ENV=production`.
- Sem seed automático em homologação — apenas as migrations são aplicadas no pré-deploy; dados de exemplo, se necessários, são inseridos manualmente e de forma exclusivamente sintética.
- Backup gerenciado do PostgreSQL de homologação **não está habilitado** (plano Hobby do workspace Railway não inclui backup de volume) — risco residual conhecido, decisão de infraestrutura pendente.
- **Gate técnico ainda aberto:** não há evidência direta de que as migrations foram efetivamente aplicadas no `fitos-postgres-hml` (apenas evidência indireta: deployment `SUCCESS` e `/api/ready` respondendo 200) — ver `DEPLOY-HOMOLOGACAO.md`, seção 5.

Detalhes completos de execução, smoke test e o gate de migrations pendente estão em `docs/06-engenharia/evidencias/FIT-008/DEPLOY-HOMOLOGACAO.md`.

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

- backup gerenciado do PostgreSQL: não habilitado em homologação (plano Hobby não inclui); decisão de plano/custo para produção permanece pendente — ver `DEPLOY-HOMOLOGACAO.md`;
- comprovação direta de que as migrations foram aplicadas em homologação (gate técnico ainda aberto — ver `DEPLOY-HOMOLOGACAO.md`, seção 5) — a mesma verificação será exigida antes de qualquer produção;
- política de migrations para produção (homologação usa `prisma migrate deploy` no pré-deploy; produção ainda não existe nesta Sprint);
- domínio e URLs de produção;
- orçamento e alertas de consumo;
- processo de rollback e recuperação testado em produção (homologação documenta rollback de deploy via Railway; produção seguirá o mesmo princípio quando existir).
