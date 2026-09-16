# Deploy em homologação (FIT-008)

Este documento registra o estado real da FIT-008 nesta rodada: o que foi entregue em código/configuração nesta PR, o que já existia provisionado no Railway antes desta PR, e o que **não** pôde ser executado neste ambiente de execução por falta de credencial Railway — com os comandos exatos necessários para concluir.

## 1. Estado herdado do Railway (informado pelo Produto, anterior a esta PR)

Os dados abaixo foram informados pelo Produto como já provisionados antes do início desta História. Este agente não teve acesso ao Railway para verificá-los independentemente nesta rodada (ver seção 3).

- Projeto: `FitOS` — project ID `d721a8fb-db7f-43f2-a994-b1df66cb8dd9`.
- Ambiente: environment ID `3f809456-55b0-4eba-b7a2-f91b53e69bcb`, nome **`production`** (nome padrão criado pelo Railway; ver seção 3 para a renomeação pendente para `homologacao`).
- Serviço web: `fitos-web-hml`, service ID `2e6422fe-9a17-4e5c-8049-02ac705bc50b`.
- Deployment aprovado: `7a9c5a64-2285-4625-9eb2-843fed7ace53`, URL `https://fitos-web-hml-production.up.railway.app`, código implantado no commit `d8cc585988dac2fc4f0a646f1352e11e5d3ecb2e` (merge do PR #19, FIT-007), status `SUCCESS`, healthcheck em `/api/health`.
- Variáveis já configuradas no serviço web: `NEXT_PUBLIC_APP_NAME=FitOS`, `NEXT_PUBLIC_APP_ENV=homologacao`, `NODE_ENV=production`.
- Esse deployment **não** inclui o código desta História (endpoint `/api/ready`, `railway.json`) — ele é anterior a esta PR.

## 2. O que esta PR entrega em código/configuração (rastreável no repositório)

- `src/app/api/ready/route.ts` — endpoint de readiness: `SELECT 1` via Prisma contra `DATABASE_URL`; `200 { "status": "ready" }` quando o PostgreSQL responde, `503 { "status": "unavailable" }` quando não. A resposta nunca inclui mensagem de erro, host, porta ou credencial — testado explicitamente (`route.test.ts`) simulando uma falha de conexão com uma mensagem de erro real (contendo host/porta/usuário) e verificando que nenhum desses dados aparece no corpo da resposta.
- `src/app/api/ready/route.test.ts` — 2 testes: readiness com banco disponível (200) e indisponível (503, sem detalhes internos).
- `railway.json` — configuração de deploy como código, versionada no repositório:
  - `deploy.preDeployCommand`: `npm run db:migrate:deploy` (aplica migrations de forma aditiva/não destrutiva antes de cada deploy, na linha já usada em desenvolvimento — ver `docs/06-engenharia/EXECUCAO-LOCAL.md`);
  - `deploy.startCommand`: `npm run start`;
  - `deploy.healthcheckPath`: `/api/health`;
  - `build.builder`: `NIXPACKS` (padrão do Railway para projetos Next.js).
  - Este arquivo torna a configuração de pré-deploy rastreável em código; para ter efeito, o serviço `fitos-web-hml` no Railway precisa estar configurado para ler `railway.json` do repositório (configuração de serviço, não coberta neste PR — ver seção 3).
- Nenhum seed automático foi adicionado a esse fluxo — `railway.json` não referencia `db:seed`, conforme exigido.
- Documentação: `docs/06-engenharia/arquitetura/AMBIENTES-E-DEPLOY.md` (topologia Railway da FIT-008) e este arquivo.

## 3. Ações de infraestrutura Railway — bloqueadas por falta de credencial nesta sessão

O ambiente de execução usado para esta rodada tem o Railway CLI instalado (`railway 5.57.2`), mas **sem nenhuma credencial Railway configurada** (`railway whoami` retorna `Unauthorized`; não há `RAILWAY_TOKEN`/`RAILWAY_API_TOKEN` no ambiente, e não há navegador disponível para `railway login` interativo). Por isso, as ações abaixo — todas exigidas pela História — **não foram executadas** nesta rodada:

| # | Ação exigida | Status | Comando exato para concluir (com um token Railway válido) |
|---|---|---|---|
| 1 | Renomear ambiente `production` → `homologacao`, preservando o environment ID | **Pendente** | `railway environment rename homologacao --environment 3f809456-55b0-4eba-b7a2-f91b53e69bcb --project d721a8fb-db7f-43f2-a994-b1df66cb8dd9` (ou via dashboard: Settings do ambiente → Rename). Caso o Railway não permita renomear diretamente, seguir o plano B da História (criar `homologacao`, mover/recriar `fitos-web-hml`, remover o ambiente padrão vazio, sem deixar deployment funcional de produção). |
| 2 | Criar PostgreSQL `fitos-postgres-hml` na homologação | **Pendente** | `railway add --database postgres --service fitos-postgres-hml --environment 3f809456-55b0-4eba-b7a2-f91b53e69bcb --project d721a8fb-db7f-43f2-a994-b1df66cb8dd9` |
| 3 | Configurar `DATABASE_URL` no serviço web com referência segura ao Postgres | **Pendente** | `railway variables --set 'DATABASE_URL=${{fitos-postgres-hml.DATABASE_URL}}' --service fitos-web-hml --environment 3f809456-55b0-4eba-b7a2-f91b53e69bcb --project d721a8fb-db7f-43f2-a994-b1df66cb8dd9` |
| 4 | Confirmar que o serviço web usa `railway.json` desta branch para o pré-deploy | **Pendente** | Verificar/ajustar em Settings do serviço `fitos-web-hml` no dashboard, ou `railway service` via CLI, que a config path aponta para `railway.json` na raiz do repositório. |
| 5 | Fazer deploy do SHA desta branch (`feat/FIT-008-ambiente-railway`) no serviço de homologação | **Pendente** | `railway up --service fitos-web-hml --environment 3f809456-55b0-4eba-b7a2-f91b53e69bcb --project d721a8fb-db7f-43f2-a994-b1df66cb8dd9` (a partir do checkout do commit da branch), ou via integração GitHub do Railway apontando para a branch/PR. |
| 6 | Executar smoke test (página inicial, `/api/health`, `/api/ready`, confirmação de migrations, inspeção de logs, ausência de dados reais/segredos) | **Pendente** — depende de 1–5 | `curl` nos três endpoints da URL pública do novo deployment; `railway logs --service fitos-web-hml --environment 3f809456-55b0-4eba-b7a2-f91b53e69bcb` para inspecionar logs do pré-deploy (migrations) e da aplicação. |

**Nenhuma dessas ações foi simulada ou declarada como concluída.** Nenhum deployment ID, resultado de migration, resultado de healthcheck/readiness ou log real para o código desta História existe ainda, porque o deploy do código desta PR no Railway não ocorreu nesta sessão.

## 4. Situação de backup

Não verificada nesta rodada, pelo mesmo motivo de acesso. Railway oferece backup gerenciado do PostgreSQL como recurso pago por plano — decisão de habilitar (e sua retenção) permanece pendente e deve ser registrada aqui quando o serviço `fitos-postgres-hml` existir e a decisão for tomada. Até lá, `docs/06-engenharia/arquitetura/AMBIENTES-E-DEPLOY.md` mantém esse item em "Pendências antes do provisionamento de produção".

## 5. Rollback (deploy)

Documentado para quando o deploy desta História puder ser executado: Railway mantém o histórico de deployments por serviço; reverter significa promover novamente o deployment anterior (`7a9c5a64-2285-4625-9eb2-843fed7ace53` ou o último estável) via dashboard (`Deployments → Redeploy`) ou `railway redeploy --deployment <id>`. Como o pré-deploy só aplica migrations (`prisma migrate deploy`, aditivo), reverter o código não desfaz uma migration já aplicada — qualquer rollback de schema exige uma migration reversa própria, nunca editar uma migration já aplicada (mesma regra usada em FIT-007).

## 6. Próximos passos para concluir esta História

1. Fornecer a este agente (ou executar diretamente) um token Railway com acesso ao projeto `FitOS` (`d721a8fb-db7f-43f2-a994-b1df66cb8dd9`), como variável `RAILWAY_TOKEN`, para completar as ações da seção 3.
2. Com as ações 1–5 da seção 3 concluídas, repetir o smoke test (ação 6) e atualizar este documento com os IDs, resultados e evidências reais (sem credenciais, sem dados reais).
3. Só então considerar a FIT-008 pronta para revisão de Produto/Design/Gate Técnico — nenhuma dessas confirmações deve ser assumida como feita a partir apenas deste PR de código.
