# Execução local da aplicação (FIT-006)

Este documento descreve como executar localmente a fundação executável do FitOS, criada na FIT-006 (SPRINT-03 — Fundação Executável).

## Requisitos

- Node.js 22 (versão oficial do projeto).
- npm.

## Instalação

```bash
npm ci
```

`package-lock.json` é versionado e obrigatório para instalação reproduzível (`npm ci`). Nenhuma variável de ambiente é obrigatória para rodar a aplicação nesta História. `.env.example` documenta as variáveis conhecidas; nenhuma delas é sensível.

## Scripts disponíveis

| Script | Comando | Descrição |
|---|---|---|
| `dev` | `npm run dev` | Servidor de desenvolvimento em `http://localhost:3000`. |
| `build` | `npm run build` | Build de produção do Next.js. |
| `start` | `npm run start` | Serve o build de produção (executar após `build`). |
| `lint` | `npm run lint` | ESLint flat config (`eslint.config.mjs`, baseado em `eslint-config-next/core-web-vitals`). |
| `typecheck` | `npm run typecheck` | `tsc --noEmit`, modo estrito. |
| `test` | `npm run test` | Testes de unidade/componente com Vitest + Testing Library. |

## Verificação de saúde

Com a aplicação em execução, `GET /api/health` retorna:

```json
{ "status": "ok", "app": "FitOS", "env": "development", "timestamp": "..." }
```

## Estrutura de pastas

```text
src/
  app/                 rotas do App Router, layout raiz, healthcheck
  modules/             limites de domínio (identity, tenancy, students, exercises,
                       training, execution, evolution, student-finance,
                       saas-subscription) — nesta História, apenas limites
                       estruturais/documentais, sem regra de negócio
  shared/
    ui/                componentes-base mínimos (Button, Card)
    design-system/     tokens M3 (docs/03-design/M3-DESIGN-TOKENS.md) em CSS
    config/             leitura de variáveis de ambiente públicas
    lib/               utilitários compartilhados (reservado)
    observability/     reservado para Sentry/logs (OBSERVABILIDADE.md)
  integrations/        adaptadores para provedores externos (reservado)
  test/                configuração global dos testes (Vitest + jsdom)
```

## Stack validada

Next.js 16.3.5, React/React DOM 19.3.0, TypeScript 5.9.3, ESLint 9.39.5 + `eslint-config-next` 16.3.5 (flat config), Vitest 5.0.1, Node.js 22. `npm audit`: zero vulnerabilidades.

## O que esta fundação prova

- a aplicação Next.js/TypeScript inicializa, builda e serve páginas;
- o tema Material Design 3 (cores, tipografia, forma, espaçamento, movimento) está aplicado a partir dos tokens oficiais, com suporte a claro/escuro;
- a estrutura modular reflete os limites de `docs/06-engenharia/arquitetura/VISAO-ARQUITETURAL.md`;
- há um healthcheck mínimo e testes automatizados da fundação.

## O que esta fundação não prova (fora do escopo da FIT-006)

- persistência em banco de dados (Prisma/PostgreSQL — FIT-007);
- ambientes Railway (FIT-008);
- autenticação (Better Auth/Clerk) ou cobrança (Asaas/Mercado Pago);
- qualquer funcionalidade de Alunos, Exercícios, Treinos, Execução, Evolução ou Financeiro.

## Evidência visual

Capturas de tela (mobile claro/escuro, desktop) em `docs/06-engenharia/evidencias/FIT-006/`.
