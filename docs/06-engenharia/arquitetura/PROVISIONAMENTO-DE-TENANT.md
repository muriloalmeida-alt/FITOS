# Provisionamento de tenant (FIT-010)

Este documento detalha como a FIT-010 garante que cada personal autenticado possua exatamente um tenant, complementando `MODELO-MULTITENANT.md` (regra de produto) e `AUTENTICACAO-E-SESSAO.md` (FIT-009, base de autenticação sobre a qual esta História se apoia).

## Regra central

1 personal = 1 tenant. O tenant é sempre derivado do usuário autenticado (`session.user`) — nunca de um `ownerId`/`tenantId` enviado pelo cliente. Não existe, em nenhuma função pública deste módulo, um parâmetro que aceite esses valores de fora: a única forma de influenciar qual tenant é provisionado é controlar qual usuário está autenticado.

## Onde vive a lógica

- `src/modules/tenancy/ensureTenantForPersonal.ts` — função pura e idempotente: dado um usuário PERSONAL, garante que ele tenha um tenant (cria se não existir, retorna o existente se já existir). Não depende de sessão nem de `modules/identity` — só de Prisma. Isso é deliberado: é chamada diretamente pelo hook de cadastro em `identity/auth.ts`, e um import de volta para `identity` criaria um ciclo de módulos (`auth.ts` → `ensureTenantForPersonal.ts` → `session.ts` → `auth.ts`).
- `src/modules/tenancy/provisionTenant.ts` — `provisionTenantForCurrentSession()`: wrapper que deriva o usuário da sessão do servidor (`getServerSession`) e delega para `ensureTenantForPersonal`. Usado pelas páginas autenticadas (hoje, `/painel`).

## Fluxo normal (no cadastro)

`src/modules/identity/auth.ts` registra `databaseHooks.user.create.after`: assim que o Better Auth insere um novo `User`, se `role === "PERSONAL"`, chama `ensureTenantForPersonal` imediatamente. Isso cobre o caso comum sem exigir nenhuma ação adicional do fluxo de cadastro (`/criar-conta`) — o personal já tem tenant quando chega em `/painel`.

## Por que não é uma única transação SQL com a criação do usuário

O hook do Better Auth roda **depois** que o `User` já foi inserido (não faz parte da mesma transação do adapter Prisma do provedor). Forçar atomicidade completa exigiria reimplementar o fluxo de cadastro por fora do Better Auth, perdendo o tratamento de sessão/cookies que o provedor já resolve — trade-off que não vale a pena para este MVP. Em vez disso, a garantia real é:

- a criação do `Tenant` em si é atômica (um único `INSERT`, a constraint física `tenants.ownerId @unique` da FIT-007 garante que nunca existem dois tenants para o mesmo `ownerId`);
- se o hook falhar (ex.: banco indisponível no instante exato após o `User` já existir), o erro é registrado (sem dados sensíveis) e **não** é relançado — o cadastro em si não falha, porque o `User` já existe e é válido;
- o personal fica temporariamente "sem tenant"; esse estado é **reparado automaticamente e de forma idempotente** na próxima vez que `provisionTenantForCurrentSession()` for chamado (hoje, ao carregar `/painel`) — não é necessário nenhum processo assíncrono, fila ou intervenção manual.

## Idempotência e concorrência

`ensureTenantForPersonal`:
1. Busca um tenant existente para `ownerId = user.id`. Se existir, retorna — nenhuma criação.
2. Se não existir, tenta criar. Se a criação falhar por violação da constraint única `tenants.ownerId` (código Prisma `P2002`) — cenário de corrida, quando duas chamadas concorrentes tentam provisionar o mesmo personal ao mesmo tempo — a chamada perdedora simplesmente busca e retorna o tenant que a vencedora acabou de criar, em vez de propagar o erro.

Isso significa que chamar a função múltiplas vezes, sequencial ou concorrentemente, para o mesmo personal, sempre resulta em exatamente um tenant — testado com chamadas em `Promise.all`.

## Nome do tenant

`"Espaço de {primeiro nome}"`, onde o primeiro nome é extraído de `user.name` (primeira palavra). Escolhido por ser simples, não exigir nenhum campo adicional no cadastro (`/criar-conta` já coleta o nome completo) e não aumentar a fricção do fluxo. Editável pelo personal é uma funcionalidade futura, não implementada nesta História.

## Quem nunca provisiona tenant

- **Aluno** (`role === "ALUNO"`): `ensureTenantForPersonal` lança erro explicitamente se o usuário não for PERSONAL — testado. `provisionTenantForCurrentSession` retorna `null` sem tocar o banco quando a sessão pertence a um aluno — também testado.
- **Não autenticado**: `provisionTenantForCurrentSession` retorna `null` sem tocar o banco quando não há sessão — testado (com `getServerSession` mockado).

## O que esta História não faz

- Não altera nenhuma migration existente — nenhuma migration nova foi necessária (a constraint física `tenants.ownerId @unique` já existia desde a FIT-007).
- Não implementa edição do nome do tenant pelo usuário.
- Não implementa nenhuma auditoria formal do provisionamento além do log de erro (sem dados sensíveis) quando o hook falha — auditoria estruturada mais ampla é `AuditEvent` (FIT-007), fora do escopo desta rodada específica.

## Testes

`src/modules/tenancy/ensureTenantForPersonal.integration.test.ts` (PostgreSQL real): provisionamento normal, idempotência, concorrência (3 chamadas simultâneas), rejeição para papel ALUNO, reparo de personal existente sem tenant, personal com tenant já existente (não duplica), e um teste de ponta a ponta que cria uma conta real via `signUpEmail` e confirma que o tenant já existe imediatamente depois, sem nenhuma chamada adicional.

`src/modules/tenancy/provisionTenant.test.ts` (unitário, com `getServerSession`/`ensureTenantForPersonal` mockados): usuário não autenticado, usuário ALUNO, e o caminho feliz confirmando que o usuário da sessão (e nenhum outro parâmetro) é o que chega até `ensureTenantForPersonal`.
