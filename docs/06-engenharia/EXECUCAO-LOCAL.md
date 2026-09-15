# Execução local da aplicação (FIT-006)

Este documento descreve como executar localmente a fundação executável do FitOS, criada na FIT-006 (SPRINT-03 — Fundação Executável).

## Requisitos

- Node.js 20 ou superior (validado nesta História com Node 22).
- npm.

## Instalação

```bash
npm install
```

Nenhuma variável de ambiente é obrigatória para rodar a aplicação nesta História. `.env.example` documenta as variáveis conhecidas; nenhuma delas é sensível.

## Scripts disponíveis

| Script | Comando | Descrição |
|---|---|---|
| `dev` | `npm run dev` | Servidor de desenvolvimento em `http://localhost:3000`. |
| `build` | `npm run build` | Build de produção do Next.js. |
| `start` | `npm run start` | Serve o build de produção (executar após `build`). |
| `lint` | `npm run lint` | ESLint (`next/core-web-vitals`). |
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

## Risco técnico conhecido

`npm audit` reporta um alerta residual moderado/alto herdado do `postcss` empacotado pelo Next.js 15.5.25 (leitura de sourcemap/arquivo via entrada não confiável). A correção completa exige Next.js 16 (major, requer React 19) e não foi aplicada nesta História — fica registrada como decisão pendente de avaliação futura de Produto/Engenharia em `docs/06-engenharia/arquitetura/DECISOES-PENDENTES.md`. Não há exposição aplicável nesta fundação: não há CSS fornecido por usuário nem sourcemap servido publicamente.
