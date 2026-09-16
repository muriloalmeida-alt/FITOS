# Deploy em homologação (FIT-008)

Este documento registra o estado real e final do provisionamento e deploy da FIT-008 em homologação. O código e a configuração (`src/app/api/ready/`, `railway.json`) foram entregues pelo Claude Code nesta PR; o provisionamento Railway em si (ambiente, PostgreSQL, variáveis, deploy) foi executado diretamente pelo GPT do Murilo, com acesso ao Railway que este agente não possui neste ambiente de execução. Os dados desta seção refletem o retorno dessa execução, não uma verificação independente feita por este agente — exceto onde indicado explicitamente como tentativa própria (seção 6).

## 1. Projeto e ambiente

- Projeto: `FitOS` — project ID `d721a8fb-db7f-43f2-a994-b1df66cb8dd9`.
- Ambiente de homologação: nome retornado pela API Railway **`"homologacao "`** (com um espaço ao final — inconsistência de nomenclatura conhecida, não corrigida nesta rodada por não ser bloqueante), environment ID `8a742a2f-f84a-4222-887f-5684c12fbc79`. Este ambiente foi **criado separadamente** (não é o `production` original renomeado).
- Ambiente `production` original (environment ID `3f809456-55b0-4eba-b7a2-f91b53e69bcb`): **não foi renomeado, removido ou alterado** nesta rodada. Continua existindo com o deployment anterior `7a9c5a64-2285-4625-9eb2-843fed7ace53` — não recebeu nenhum redeploy nesta rodada. Nenhuma produção funcional foi criada ou configurada.

## 2. Serviço web (`fitos-web-hml`)

- Service ID: `2e6422fe-9a17-4e5c-8049-02ac705bc50b`.
- Branch implantada: `feat/FIT-008-ambiente-railway`.
- Commit implantado: `071ba1e91c24702c44d488cae2b554741d194cc0` (head do PR #20 no momento do deploy).
- Deployment final: `1c5a6a50-9369-46d3-b888-c286d8a70337` — status `SUCCESS`.
- URL pública: `https://fitos-web-hml-homologacao.up.railway.app`
- Configuração efetiva do serviço:
  - Build: `npm run build`.
  - Start: `npm run start`.
  - Pré-deploy: `npm run db:migrate:deploy`.
  - Healthcheck: `/api/health`.
  - Builder efetivo informado pelo Railway: **Railpack** (não Nixpacks — `railway.json` desta PR declara `"builder": "NIXPACKS"`; o Railway aplicou Railpack como builder efetivo. Isso não impediu o deploy, mas é uma divergência entre a configuração versionada e o comportamento observado, registrada aqui para revisão futura, não corrigida nesta rodada por não ser bloqueante ao resultado).
  - Nenhum seed automático foi executado ou configurado.

## 3. PostgreSQL (`fitos-postgres-hml`)

- Service ID: `b3567d92-b727-466c-ba64-9ecfc7698f4a`.
- Deployment: `4e400709-1b35-4e4a-8fa3-a6136a0dd7fb` — status `SUCCESS`.
- Imagem: `ghcr.io/railwayapp-templates/postgres-ssl:18`.
- Volume ID: `7d56bee9-0a3a-4853-a89c-d1a1579bdd5c`, mount path `/var/lib/postgresql/data`, capacidade 5 GB, região `sfo`.
- `DATABASE_URL` configurada no serviço `fitos-web-hml` **exclusivamente por referência** às variáveis do serviço `fitos-postgres-hml` (sintaxe `${{fitos-postgres-hml.<VARIÁVEL>}}`). Nenhuma string de conexão fixa foi colocada em código, PR ou Issue. Nenhuma credencial é transcrita neste documento.

## 4. Smoke test (executado contra a URL pública de homologação)

| Verificação | Resultado |
|---|---|
| `GET /` | HTTP 200 — página inicial carregada corretamente |
| `GET /api/health` | HTTP 200 — `{"status":"ok","app":"FitOS","env":"homologacao",...}` |
| `GET /api/ready` | HTTP 200 — `{"status":"ready"}` |
| Logs da aplicação | Next.js 16.3.5 iniciou corretamente; aplicação respondeu aos healthchecks; nenhum dado real encontrado; nenhum segredo, senha ou string de conexão encontrado nos logs. Único aviso presente (não bloqueante): `npm warn config production Use --omit=dev instead.` |

`/api/ready` responder 200 confirma que o PostgreSQL está acessível pela aplicação — mas isso comprova apenas conectividade, não que o schema (migrations) esteja no estado esperado (ver seção 5).

## 5. Migrations — gate técnico ainda não comprovado

O serviço está configurado com `preDeployCommand = npm run db:migrate:deploy` (`railway.json`), e o deployment terminou com status `SUCCESS`. Isso é consistente com o pré-deploy tendo rodado sem erro fatal (um erro no pré-deploy normalmente impede o deploy de suceder), mas **não é prova direta**:

- A API e os logs de deploy acessíveis durante a execução do GPT do Murilo não mostraram a saída específica do estágio de pré-deploy.
- Não foi possível consultar diretamente a tabela `_prisma_migrations` no Postgres de homologação pelas ferramentas disponíveis àquela execução.
- Este agente (Claude Code) tentou, nesta rodada, verificar de forma independente rodando `railway whoami` neste ambiente de execução: continua retornando `Unauthorized` — sem `RAILWAY_TOKEN` configurado aqui, não há como este agente executar `npx prisma migrate status` contra o Postgres real de homologação nem inspecionar os logs do Railway diretamente.

**Conclusão explícita: não há evidência conclusiva de que as migrations foram efetivamente aplicadas no `fitos-postgres-hml`.** `/api/ready` = 200 e deployment = `SUCCESS` são evidências indiretas favoráveis, não uma comprovação. Esta é uma pendência classificada como **gate técnico bloqueante antes da aprovação final do PR #20** — não uma formalidade.

**Ação recomendada para fechar o gate:** com um `RAILWAY_TOKEN` válido (ou pelo GPT do Murilo, que já tem acesso), rodar `npx prisma migrate status` (ou `railway run npx prisma migrate status --service fitos-web-hml --environment 8a742a2f-f84a-4222-887f-5684c12fbc79`) contra o ambiente de homologação e registrar aqui os nomes das migrations aplicadas e o resultado — sem expor `DATABASE_URL` ou qualquer credencial. Se houver migration pendente, aplicar apenas via `npm run db:migrate:deploy` (nunca editar uma migration existente) e então registrar o resultado.

## 6. Backup

- Backup gerenciado **não está habilitado** no serviço `fitos-postgres-hml`.
- Motivo: o workspace Railway está no plano Hobby, cujo limite efetivo é zero backups por volume.
- Habilitar backup exigiria mudança de plano — decisão de custo que não foi tomada nesta rodada e não deve ser tomada unilateralmente por automação.
- **Registrado como risco residual conhecido e decisão pendente de infraestrutura.** Nenhuma mudança de plano ou contratação de recurso pago foi feita.

## 7. Confirmações de governança

- Nenhum dado real foi utilizado em nenhuma etapa (seed sintético existente não foi executado; nenhum dado de produção foi copiado).
- Nenhuma credencial foi registrada em código, commit, PR ou Issue — `DATABASE_URL` existe apenas como variável de referência configurada no serviço Railway.
- O ambiente `production` (environment ID `3f809456-55b0-4eba-b7a2-f91b53e69bcb`) permanece inalterado, com o deployment anterior `7a9c5a64-2285-4625-9eb2-843fed7ace53` — nenhuma produção funcional foi criada, alterada ou redeployada.
- Nenhum seed automático foi configurado ou executado no pipeline de deploy.
- Nenhuma migration existente foi alterada.
- FIT-009 não foi iniciada.

## 8. Rollback (deploy)

Railway mantém o histórico de deployments por serviço; reverter significa promover novamente o deployment anterior — para `fitos-web-hml`, isso seria o estado anterior a `1c5a6a50-9369-46d3-b888-c286d8a70337` — via dashboard (`Deployments → Redeploy`) ou `railway redeploy --deployment <id>`. Como o pré-deploy só aplica migrations de forma aditiva (`prisma migrate deploy`), reverter o código não desfaz uma migration já aplicada — qualquer rollback de schema exige uma migration reversa própria, nunca editar uma migration já aplicada (mesma regra usada em FIT-007).

## 9. Situação final e próximo passo

A FIT-008 **não está pronta para aprovação final** enquanto o gate de migrations (seção 5) não for fechado com evidência direta. Recomenda-se:

1. Fechar o gate de migrations (comando indicado na seção 5), com um token Railway válido.
2. Registrar aqui o resultado exato (nomes das migrations, sem dados sensíveis).
3. Só então submeter o PR #20 à revisão final de Produto/Design/Gate Técnico para autorização de merge.

Até lá, o PR #20 permanece aberto, sem merge, com a FIT-008 classificada como **em andamento, bloqueada exclusivamente pela comprovação das migrations**.
