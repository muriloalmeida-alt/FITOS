# Execução local da aplicação (FIT-006/FIT-007)

Este documento descreve como executar localmente a fundação executável do FitOS (FIT-006) e o banco de dados multi-tenant (FIT-007).

## Requisitos

- Node.js 22 (versão oficial do projeto).
- npm.
- PostgreSQL 16 (local, Docker ou outro meio — apenas para desenvolvimento/testes; Railway é escopo da FIT-008).

## Instalação

```bash
npm ci
```

`package-lock.json` é versionado e obrigatório para instalação reproduzível (`npm ci`).

## Banco de dados (FIT-007)

1. Crie dois bancos PostgreSQL locais: um de desenvolvimento e um de testes (nomes livres; os exemplos abaixo usam `fitos_dev` e `fitos_test`).
2. Copie `.env.example` para `.env` e preencha `DATABASE_URL` com a string de conexão do banco de desenvolvimento. Nenhum valor real deve ser usado — este é um ambiente local.
3. Aplique as migrations no banco de desenvolvimento:

   ```bash
   npm run db:migrate
   ```

4. (Opcional) Popule dados sintéticos de exemplo:

   ```bash
   npm run db:seed
   ```

5. Para rodar os testes de isolamento entre tenants (`npm run test`), aplique as mesmas migrations no banco de testes, sem criar banco-sombra:

   ```bash
   DATABASE_URL="<mesma string, banco fitos_test>" npx prisma migrate deploy
   ```

   Os testes derivam a URL do banco de testes a partir de `DATABASE_URL` (troca apenas o nome do banco por `fitos_test`) — ver `src/shared/db/testDatabaseUrl.ts`.

## Scripts disponíveis

| Script | Comando | Descrição |
|---|---|---|
| `dev` | `npm run dev` | Servidor de desenvolvimento em `http://localhost:3000`. |
| `build` | `npm run build` | Build de produção do Next.js. |
| `start` | `npm run start` | Serve o build de produção (executar após `build`). |
| `lint` | `npm run lint` | ESLint flat config (`eslint.config.mjs`, baseado em `eslint-config-next/core-web-vitals`). |
| `typecheck` | `npm run typecheck` | `tsc --noEmit`, modo estrito. |
| `test` | `npm run test` | Testes de unidade/componente (Vitest + Testing Library) e de isolamento multi-tenant (Prisma + PostgreSQL real). |
| `db:migrate` | `npm run db:migrate` | `prisma migrate dev` — cria/aplica migrations em desenvolvimento. |
| `db:migrate:deploy` | `npm run db:migrate:deploy` | `prisma migrate deploy` — aplica migrations sem criar banco-sombra (CI/homologação). |
| `db:seed` | `npm run db:seed` | Popula dados sintéticos (`prisma/seed.ts`). |
| `db:studio` | `npm run db:studio` | Abre o Prisma Studio para inspecionar o banco local. |

## Verificação de saúde

Com a aplicação em execução, `GET /api/health` retorna:

```json
{ "status": "ok", "app": "FitOS", "env": "development", "timestamp": "..." }
```

## Estrutura de pastas

```text
prisma/
  schema.prisma        modelo físico multi-tenant (FIT-007)
  migrations/           histórico de migrations
  seed.ts               dados sintéticos de exemplo
src/
  app/                 rotas do App Router, layout raiz, healthcheck
  modules/             limites de domínio (identity, tenancy, students, exercises,
                       training, execution, evolution, student-finance,
                       saas-subscription) — a maioria ainda apenas limites
                       estruturais/documentais; tenancy tem modelo físico e
                       testes de isolamento (FIT-007)
  shared/
    ui/                componentes-base mínimos (Button, Card)
    design-system/     tokens M3 (docs/03-design/M3-DESIGN-TOKENS.md) em CSS
    config/             leitura de variáveis de ambiente públicas
    db/                cliente Prisma e utilitário de URL do banco de testes
    lib/               utilitários compartilhados (reservado)
    observability/     reservado para Sentry/logs (OBSERVABILIDADE.md)
  integrations/        adaptadores para provedores externos (reservado)
  test/                configuração global dos testes (Vitest + jsdom)
```

## Stack validada

Next.js 16.3.5, React/React DOM 19.3.0, TypeScript 5.9.3, ESLint 9.39.5 + `eslint-config-next` 16.3.5 (flat config), Vitest 5.0.1, Prisma/`@prisma/client` 6.19.3, PostgreSQL 16, Node.js 22. `npm audit`: zero vulnerabilidades.

## O que a fundação prova até aqui (FIT-006 + FIT-007)

- a aplicação Next.js/TypeScript inicializa, builda e serve páginas;
- o tema Material Design 3 está aplicado, com suporte a claro/escuro;
- a estrutura modular reflete os limites de `VISAO-ARQUITETURAL.md`;
- há um healthcheck mínimo e testes automatizados da fundação;
- o modelo físico multi-tenant existe, com migrations rastreáveis e constraints reais que impedem 1 personal ter mais de 1 tenant, um aluno pertencer a mais de 1 tenant, e um tenant ter mais de 1 assinatura SaaS;
- consultas/updates/deletes escopados por tenant errado nunca afetam dados de outro tenant, verificado por teste automatizado contra um PostgreSQL real.

## O que ainda não está implementado

- autenticação (Better Auth/Clerk) ou cobrança (Asaas/Mercado Pago);
- derivação real de `tenant_id` a partir de uma sessão autenticada (depende da prova técnica de autenticação);
- ambientes Railway (FIT-008);
- qualquer funcionalidade de Alunos, Exercícios, Treinos, Execução, Evolução ou Financeiro além do modelo físico.

## Evidência visual (FIT-006)

Capturas de tela (mobile claro/escuro, desktop) em `docs/06-engenharia/evidencias/FIT-006/`.
