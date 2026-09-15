# Modelo físico de dados (FIT-007)

Este documento registra o schema físico inicial do FitOS, implementado com Prisma + PostgreSQL, e complementa o modelo conceitual em `MODELO-DE-DADOS-CONCEITUAL.md` e as regras de tenancy em `MODELO-MULTITENANT.md`.

## Stack

- PostgreSQL 16.
- Prisma 6.19.3 (linha estável — Prisma 7 exige o novo modelo de driver adapters, uma mudança arquitetural recente demais para esta fundação; ver "Decisão de versão" abaixo).
- Schema em `prisma/schema.prisma`; migrations em `prisma/migrations/`.

## Decisão de versão (Prisma 6 vs. 7)

O Prisma 7 removeu o suporte à propriedade clássica `datasource.url = env("DATABASE_URL")`, exigindo `prisma.config.ts` e um *driver adapter* (`@prisma/adapter-pg` ou equivalente) para `migrate`/`PrismaClient`. Essa é uma mudança de arquitetura recente e ainda em adoção pelo ecossistema. Para manter a fundação estável, esta História usa Prisma 6.19.3 (última versão estável da linha 6.x), que suporta o padrão clássico sem exigir adapters. `npm audit` confirma zero vulnerabilidades nesta versão (com um `override` de `deepmerge-ts` para a versão corrigida — ver `package.json`). A migração para Prisma 7 fica registrada como decisão pendente futura, não urgente.

## Estratégia de tenant_id

Toda tabela de domínio do personal carrega `tenantId` diretamente (denormalizado, mesmo quando derivável por join), para que qualquer consulta possa ser filtrada por tenant sem depender de joins profundos. O `tenantId` nunca é aceito do cliente — é sempre derivado no servidor a partir do contexto autenticado (a implementação da derivação via sessão pertence à FIT-006B/prova de Better Auth, fora do escopo desta História, que cobre apenas a camada de dados).

## Entidades e constraints físicas

| Tabela | Constraint física | Regra que ela impõe |
|---|---|---|
| `tenants` | `ownerId` único | 1 personal (User) só pode ser dono de 1 tenant |
| `students` | `userId` único | 1 aluno (User) só pode ter 1 perfil de Student — vínculo a exatamente 1 tenant |
| `saas_subscriptions` | `tenantId` único | no máximo 1 assinatura SaaS por tenant |
| todas as tabelas de domínio | `tenantId` obrigatório (exceto `exercises`, ver abaixo) + índice em `tenantId` | consulta/filtro direto por tenant; nenhuma tabela de negócio "solta" sem tenant |
| `exercises` | `tenantId` opcional (nulo = catálogo global da API Ninjas; preenchido = exercício próprio do personal) | distingue catálogo global de exercícios próprios, conforme `REGRAS-DE-NEGOCIO.md` |

`StudentCharge` e `SaasSubscription` não possuem nenhuma coluna de chave estrangeira ou relação Prisma entre si — são estruturalmente independentes, conforme `ASSINATURA-SAAS.md`. Um teste automatizado (`isolation.integration.test.ts`) verifica essa ausência de relação diretamente no DMMF do Prisma.

Valores monetários (`StudentCharge.amountCents`) e de peso (`Assessment.weightGrams`) são armazenados como `Int` (menor unidade — centavos/gramas), nunca como ponto flutuante binário, conforme `docs/01-produto/REGRAS-DE-NEGOCIO.md`.

## Migrations

- `prisma/migrations/20260915233539_init_multitenant_schema/migration.sql` — cria todas as tabelas, enums, índices e foreign keys do modelo físico inicial.
- Aplicar em desenvolvimento: `npm run db:migrate` (roda `prisma migrate dev`, cria banco-sombra para validar o diff).
- Aplicar em CI/homologação (sem shadow database): `npm run db:migrate:deploy` (roda `prisma migrate deploy`).

### Rollback

Esta é a migration inicial — não há um estado anterior para reverter além de um banco vazio. O rollback documentado para esta migration é o `DROP` completo das tabelas/enums criados, executado apenas em ambiente de desenvolvimento/teste:

```sql
DROP TABLE IF EXISTS "audit_events", "saas_subscriptions", "student_charges", "assessments",
  "workout_sessions", "plan_assignments", "workout_exercises", "workouts", "training_plans",
  "exercises", "students", "tenants", "users" CASCADE;
DROP TYPE IF EXISTS "SaasSubscriptionStatus", "StudentChargeStatus", "WorkoutSessionStatus",
  "ExerciseOrigin", "StudentStatus";
```

Para migrations futuras, a política é: nunca editar uma migration já aplicada; reverter significa criar uma nova migration que desfaz a alteração (forward-only), ou restaurar a partir de backup em ambientes com dados reais (backup/retenção seguem pendentes — ver `DECISOES-PENDENTES.md`).

## Seeds

`prisma/seed.ts` cria dados **exclusivamente sintéticos**: 2 tenants fictícios, cada um com 1 personal (`User`) e 1 aluno (`Student`), 1 assinatura SaaS e 1 cobrança de aluno. Nenhum dado real de aluno ou personal é usado. Executar com `npm run db:seed`.

## Testes de constraints e isolamento

`src/modules/tenancy/isolation.integration.test.ts` roda contra um banco de testes real (`fitos_test`, migrations aplicadas via `prisma migrate deploy`) e cobre:

- consulta escopada por tenant nunca retorna registro de outro tenant;
- `updateMany`/`deleteMany` escopados por tenant errado afetam 0 linhas, mesmo conhecendo o id do registro de outro tenant (prova que "IDs difíceis de adivinhar não substituem autorização" — o filtro por tenant é o que protege, não o sigilo do id);
- constraint única impede um segundo tenant para o mesmo owner;
- constraint única impede vincular o mesmo aluno a um segundo tenant;
- constraint única impede uma segunda assinatura SaaS para o mesmo tenant;
- `StudentCharge` e `SaasSubscription` não têm nenhuma relação Prisma entre si.

## Fora do escopo desta História

- Autenticação produtiva (a derivação real de `tenantId` a partir de uma sessão autenticada depende da prova técnica do Better Auth/Clerk).
- UI funcional sobre este modelo.
- Cobrança real, API Ninjas real, Railway de produção.
- Qualquer feature completa de produto (Alunos, Treinos, Financeiro).
