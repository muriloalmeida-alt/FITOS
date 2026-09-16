# Autorização, papéis e isolamento por sessão (FIT-011)

Este documento detalha a implementação da FIT-011: a camada central de autorização do FitOS, que transforma a sessão autenticada (FIT-009) em contexto confiável de usuário, papel e tenant, apoiando-se no provisionamento automático de tenant (FIT-010). Complementa, sem substituir, `AUTENTICACAO-E-AUTORIZACAO.md` (direção de produto/arquitetura) e `AUTENTICACAO-E-SESSAO.md` (FIT-009).

## Onde vive a lógica

`src/modules/tenancy/authContext.ts` — de acordo com a tabela de responsabilidades de `VISAO-ARQUITETURAL.md`, que atribui ao módulo Tenancy "personal, vínculos e contexto do tenant". Nenhum módulo de negócio deve montar seu próprio contexto de autorização — todos consultam esta camada.

## Regra central

O `AuthContext` (`userId`, `role`, `tenantId`, `studentId`) é derivado **exclusivamente** a partir da sessão do servidor (`getServerSession()`, FIT-009) e das tabelas físicas `Tenant`/`Student` (FIT-007) — nunca de um valor enviado pelo cliente. Nenhuma função pública deste módulo aceita `tenantId`/`studentId`/`ownerId` como parâmetro proveniente de payload, cookie, header ou query string; os únicos parâmetros extras que existem (`sessionOverride`, `client`) servem exclusivamente para testes (ver "Testabilidade" abaixo) e nunca são usados em código de produção.

```ts
export type AuthContext =
  | { authenticated: false }
  | { authenticated: true; userId: string; role: "PERSONAL"; tenantId: string; studentId: null }
  | { authenticated: true; userId: string; role: "ALUNO"; tenantId: string; studentId: string }
  | { authenticated: true; userId: string; role: "ALUNO"; tenantId: null; studentId: null };
```

- **PERSONAL**: `tenantId` é sempre resolvido via `ensureTenantForPersonal` (autocura da FIT-010) — nunca nulo para um personal autenticado.
- **ALUNO com vínculo**: `tenantId`/`studentId` vêm do `Student` encontrado por `userId`.
- **ALUNO sem vínculo**: sessão válida, mas sem `Student` correspondente (ex.: conta futura ainda não vinculada, ou vínculo desfeito). É um **estado real, não um erro** — `tenantId`/`studentId` retornam `null` e todo guard trata isso como sem permissão (403), nunca como falha interna (500) ou crash.

## API de autorização

- `getAuthContext()` — monta o `AuthContext`. Uso direto é raro; a maioria do código deve usar os `require*` abaixo.
- `requireSession()` — exige qualquer sessão válida; lança `AuthError("UNAUTHENTICATED")` se não houver.
- `requirePersonal()` — exige `role === "PERSONAL"`; lança `AuthError("FORBIDDEN")` caso contrário. Retorna `{ userId, role, tenantId }` (tipo estreito, sem campos extras).
- `requireStudent()` — exige `role === "ALUNO"` **e** vínculo ativo (`tenantId`/`studentId` não nulos); lança `AuthError("FORBIDDEN")` caso contrário — inclusive para o caso "aluno sem vínculo". Retorna `{ userId, role, tenantId, studentId }`.
- `assertTenantAccess(tenantId, expectedTenantId)` — confirma que o `tenantId` do contexto de autorização corresponde ao `tenantId` de um registro de domínio sendo acessado; usar antes de qualquer leitura/escrita futura de entidade de negócio (Alunos, Exercícios, Treinos — fora do escopo desta História, mas é o padrão que elas devem seguir).
- `authErrorResponse(error)` — mapeamento único de `AuthError` para `Response` HTTP (401/403), usado por toda rota de API que dependa desta camada. Retorna `null` para erros que não são `AuthError` (o chamador relança).

## 401 vs. 403 — usados coerentemente

- **401 (`UNAUTHENTICATED`)**: não há sessão válida.
- **403 (`FORBIDDEN`)**: há sessão válida, mas sem permissão para o recurso — inclui papel incorreto (personal em rota de aluno, aluno em rota de personal) e o caso "aluno sem vínculo".
- **Nunca 404 automático** para negar acesso: esconderia a existência do recurso de forma inconsistente com o resto da aplicação. Se um recurso específico precisar de 404 para reduzir enumeração, isso é uma decisão explícita e documentada naquele recurso — não um comportamento genérico desta camada.

## Rotas de prova (comprovação end-to-end)

Três rotas mínimas, sem nenhuma funcionalidade de negócio, criadas exclusivamente para comprovar a camada de autorização de ponta a ponta:

- `GET /api/auth/context` — retorna `{ authenticated, role, tenantId, studentId }` da sessão atual (401 se não autenticado).
- `GET /api/tenancy/meu-tenant` — exige `requirePersonal()`; retorna `{ id, name }` do tenant do personal autenticado. Ignora deliberadamente qualquer `tenantId` na query string.
- `GET /api/tenancy/meu-perfil` — exige `requireStudent()`; retorna `{ id, displayName }` do `Student` do aluno autenticado. Ignora deliberadamente qualquer `studentId` na query string.

## Testabilidade

`getServerSession()` depende de `next/headers()`, que só funciona dentro do runtime de requisição do Next.js — não é chamável diretamente em teste unitário. Por isso, seguindo o mesmo padrão já usado por `ensureTenantForPersonal` (FIT-010) para o Prisma, todas as funções desta camada aceitam parâmetros opcionais exclusivos para teste:

- `sessionOverride` — substitui a chamada a `getServerSession()` por um valor simulado.
- `client: PrismaClient = prisma` — substitui o cliente Prisma padrão (ligado ao banco de desenvolvimento) por um cliente de teste.

Nenhum destes parâmetros é preenchido a partir de uma requisição real — em produção, toda chamada é `getAuthContext()`/`requirePersonal()`/`requireStudent()` sem argumentos.

## Comprovação de isolamento (testes negativos)

- Acesso cruzado entre tenants: `assertTenantAccess` rejeita quando os IDs não coincidem; aceita quando coincidem.
- Payload com `tenantId`/`studentId` adulterado: comprovado tanto no nível da camada (`authContext.integration.test.ts`, um `requirePersonal()` chamado para um usuário retorna sempre o tenant real da sessão, nunca o de outro tenant existente no banco) quanto no nível das rotas (`route.test.ts` de cada rota, comprovando que uma query string com `tenantId`/`studentId` de outro usuário é ignorada — a resposta reflete sempre o registro real da sessão).
- Papel trocado: personal tentando `requireStudent()` → `FORBIDDEN`; aluno tentando `requirePersonal()` → `FORBIDDEN`.
- Aluno sem vínculo tentando `requireStudent()` → `FORBIDDEN` (não erro interno).
- Sessão ausente: `requireSession()` → `UNAUTHENTICATED`.

## Comprovação de ponta a ponta (fora dos testes automatizados)

Além da suíte automatizada, a camada foi exercitada contra um servidor real (`npm run start`) usando cadastro/login reais via HTTP e cookies de sessão reais (não simulados), com dados sintéticos removidos do banco após a execução:

1. sem cookie, `GET /api/auth/context` → 401;
2. personal autenticado: `GET /api/auth/context` e `GET /api/tenancy/meu-tenant` → 200, com o `tenantId`/`id` reais; `GET /api/tenancy/meu-tenant?tenantId=<outro>` → 200 com o mesmo tenant real (parâmetro adulterado ignorado); `GET /api/tenancy/meu-perfil` → 403;
3. aluno autenticado (com vínculo criado diretamente no banco, já que não há cadastro público de aluno — FIT-009): `GET /api/auth/context` e `GET /api/tenancy/meu-perfil` → 200, com o `studentId`/`id` reais; `GET /api/tenancy/meu-perfil?studentId=<outro>` → 200 com o mesmo aluno real (parâmetro adulterado ignorado); `GET /api/tenancy/meu-tenant` → 403.

Nenhum dado sintético usado nesta comprovação permaneceu no banco após a execução.

## Segurança

- Nenhum segredo, token de sessão ou senha é logado por este módulo — os únicos `console.error` existentes (herdados da FIT-010, em `ensureTenantForPersonal`) registram apenas `userId`.
- `authErrorResponse` nunca inclui a mensagem interna do `AuthError` na resposta HTTP — apenas o `kind` (`"UNAUTHENTICATED"`/`"FORBIDDEN"`), evitando vazar detalhes de implementação.

## O que esta História não faz

- Não cria papéis além de `PERSONAL`/`ALUNO` (fora do escopo, conforme a Issue).
- Não implementa nenhuma funcionalidade de negócio (Alunos, Exercícios, Treinos, Financeiro) — as três rotas de prova existem apenas para comprovar a camada de autorização.
- Não altera nenhuma migration — nenhum schema novo foi necessário; toda a informação usada (`role`, `Tenant`, `Student`) já existia (FIT-007/FIT-009).
- Não implementa rate limiting nem auditoria adicional além do que já existe (`AuditEvent`, FIT-007, fora do escopo desta rodada).

## Testes

- `src/modules/tenancy/authContext.integration.test.ts` (PostgreSQL real, banco de testes): personal no próprio tenant; aluno no próprio perfil; aluno sem vínculo (sem erro); sessão ausente; `requireSession`/`requirePersonal`/`requireStudent` para os casos de sucesso e de rejeição cruzada (incluindo aluno sem vínculo tentando `requireStudent`); `assertTenantAccess` aceitando/rejeitando; payload com `tenantId` adulterado nunca substitui o tenant real da sessão.
- `src/app/api/auth/context/route.test.ts`, `src/app/api/tenancy/meu-tenant/route.test.ts`, `src/app/api/tenancy/meu-perfil/route.test.ts` (unitários, com `authContext` e `prisma` mockados): 401 sem sessão, 403 para papel incorreto, 200 com os dados corretos, e que um `tenantId`/`studentId` adulterado na query string é ignorado.
