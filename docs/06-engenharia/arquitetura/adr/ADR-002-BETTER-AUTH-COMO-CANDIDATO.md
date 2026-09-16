# ADR-002 — Better Auth como candidato

Status: **Aceito** (FIT-009, PR próprio — ver `docs/06-engenharia/arquitetura/AUTENTICACAO-E-SESSAO.md`)
Data original: 15 de setembro de 2026 · Decisão: 16 de setembro de 2026

## Contexto

Personal e aluno precisam de contas próprias, sessões seguras, recuperação e autorização por papel dentro de uma solução Next.js/PostgreSQL no Railway.

## Alternativas

- Better Auth;
- Clerk;
- Auth0;
- implementação própria.

## Proposta original

Avaliar Better Auth como candidato primário por integração TypeScript/PostgreSQL e controle sobre dados. Clerk é fallback pela maturidade e velocidade de integração.

## Prova técnica executada (FIT-009)

Better Auth **1.7.5** (última versão estável da linha 1.x — não beta/rc), integrado via `@better-auth/prisma-adapter` ao PostgreSQL/Prisma já usado pelo FitOS. Resultado por critério:

| Critério exigido | Resultado |
|---|---|
| Compatibilidade com Next.js App Router | Confirmado — `better-auth/next-js` (`toNextJsHandler`, `nextCookies()`) |
| Compatibilidade com React/TypeScript atuais | Confirmado — peer ranges `next ^14\|\|^15\|\|^16`, `react ^18\|\|^19`, sem conflito com Next 16.3.5/React 19.3.0 |
| Integração persistente com Prisma/PostgreSQL | Confirmado — adapter oficial, schema gerado a partir de `getSchema()` (não hand-waved), migration aditiva aplicada e validada em banco novo |
| Sessões seguras | Confirmado — cookies httpOnly/sameSite geridos pelo provedor; sessão expira em 7 dias, renovada a cada acesso com menos de 1 dia restante |
| Login por e-mail e senha | Confirmado — testado com credenciais válidas/inválidas |
| Criação de conta de personal | Confirmado — `/criar-conta`, testado incluindo rejeição de duplicidade |
| Logout | Confirmado — testado (remove o registro de sessão) |
| Proteção de páginas | Confirmado — `/painel` protegida por verificação server-side + otimista no `proxy.ts` |
| Acesso server-side à sessão | Confirmado — `getServerSession()` |
| Representar papéis PERSONAL/ALUNO | Confirmado — `additionalFields.role`, sempre `input: false` (nunca aceito do cliente) |
| Migrações/tabelas adicionais necessárias | `sessions`, `accounts`, `verifications` + 4 colunas em `users` — aditivas, documentadas em `AUTENTICACAO-E-SESSAO.md` |
| Funcionamento no Railway | **Não testado nesta rodada** — depende de deploy real em homologação, fora do alcance do ambiente de execução usado (mesma limitação de credencial Railway já registrada na FIT-008); ver "Limitações conhecidas" em `AUTENTICACAO-E-SESSAO.md` |
| Ausência de vulnerabilidades críticas/altas | Confirmado — `npm audit`: 0 vulnerabilidades após a instalação |
| Manutenção e reversibilidade | Aceitável — biblioteca ativa, múltiplos adapters, e a integração está isolada em `src/modules/identity/auth.ts`/`auth-client.ts` (nenhuma chamada direta ao provedor fora desses dois arquivos), permitindo troca de provedor sem reescrever módulos de negócio |

## Decisão

**Aceito.** Better Auth passa de "Proposto" para decisão confirmada. A prova cobriu todos os critérios testáveis localmente; a operação real no Railway (o único critério não coberto nesta rodada) será confirmada no primeiro deploy de homologação que incluir esta História — não é motivo para reabrir a decisão, pois a integração é padrão (mesmo Postgres, mesmas variáveis de ambiente) e não há indício de incompatibilidade específica com a plataforma.

## Consequências

- Nenhuma migração de dados de usuários reais é necessária (nenhum dado real existe ainda).
- `User` ganhou os campos `role`, `emailVerified`, `image`, `updatedAt` — aditivo, documentado.
- Recuperação de senha por e-mail e verificação de e-mail **não foram implementadas** nesta rodada (exigiriam decidir um provedor de envio de e-mail, fora do escopo da FIT-009) — lacuna conhecida, não bloqueante para o MVP atual, a ser priorizada quando necessário.
- Troca futura de provedor (ex.: para Clerk, se surgir motivo concreto) exigiria apenas reescrever `auth.ts`/`auth-client.ts` e migrar `accounts`/`sessions` — os módulos de negócio (FIT-010 em diante) devem depender de `getServerSession()`/do contexto de autorização (FIT-011), nunca do Better Auth diretamente.
