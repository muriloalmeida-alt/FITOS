# Modelo físico de dados (FIT-007)

Este documento registra o schema físico do FitOS, implementado com Prisma + PostgreSQL, e complementa o modelo conceitual em `MODELO-DE-DADOS-CONCEITUAL.md` e as regras de tenancy em `MODELO-MULTITENANT.md`.

## Stack

- PostgreSQL 16.
- Prisma 6.19.3 (linha estável — Prisma 7 exige o novo modelo de driver adapters, uma mudança arquitetural recente demais para esta fundação; ver "Decisão de versão" abaixo).
- Schema em `prisma/schema.prisma`; migrations em `prisma/migrations/`.

## Decisão de versão (Prisma 6 vs. 7)

O Prisma 7 removeu o suporte à propriedade clássica `datasource.url = env("DATABASE_URL")`, exigindo `prisma.config.ts` e um *driver adapter* (`@prisma/adapter-pg` ou equivalente) para `migrate`/`PrismaClient`. Essa é uma mudança de arquitetura recente e ainda em adoção pelo ecossistema. Para manter a fundação estável, esta História usa Prisma 6.19.3 (última versão estável da linha 6.x), que suporta o padrão clássico sem exigir adapters. `npm audit` confirma zero vulnerabilidades nesta versão (com um `override` de `deepmerge-ts` para a versão corrigida — ver `package.json`). A migração para Prisma 7 fica registrada como decisão pendente futura, não urgente.

## Estratégia de tenant_id

Toda tabela de domínio do personal carrega `tenantId` diretamente (denormalizado, mesmo quando derivável por join), para que qualquer consulta possa ser filtrada por tenant sem depender de joins profundos. O `tenantId` nunca é aceito do cliente — é sempre derivado no servidor a partir do contexto autenticado. A implementação real dessa derivação a partir de uma sessão autenticada pertence a uma História futura da prova técnica de autenticação, ainda sem identificador formal — esta História (FIT-007) cobre apenas a camada de dados: o schema garante que, uma vez que um `tenantId` correto seja fornecido pela camada de aplicação, o PostgreSQL não aceita vínculos que cruzem tenants.

## Entidades e constraints físicas

| Tabela | Constraint física | Regra que ela impõe |
|---|---|---|
| `tenants` | `ownerId` único | 1 personal (User) só pode ser dono de 1 tenant |
| `students` | `userId` único; `@@unique([id, tenantId])` | 1 aluno (User) só pode ter 1 perfil de Student; par (id, tenantId) referenciável por FK composta |
| `training_plans`, `workouts` | `@@unique([id, tenantId])` | par (id, tenantId) referenciável por FK composta pelas tabelas filhas |
| `saas_subscriptions` | `tenantId` único | no máximo 1 assinatura SaaS por tenant |
| todas as tabelas de domínio | `tenantId` obrigatório (exceto `exercises`, ver abaixo) + índice em `tenantId` | consulta/filtro direto por tenant; nenhuma tabela de negócio "solta" sem tenant |
| `exercises` | `tenantId` opcional (nulo = catálogo global da API Ninjas; preenchido = exercício próprio do personal) | distingue catálogo global de exercícios próprios, conforme `REGRAS-DE-NEGOCIO.md` |

## Integridade relacional entre registros do mesmo tenant

A primeira versão desta História (revisada no PR #19) tinha uma lacuna: `tenantId` existia e estava indexado em toda tabela, mas as relações entre tabelas (por exemplo `Workout.trainingPlanId → TrainingPlan.id`) usavam apenas o id do registro pai. Isso permitia, por exemplo, um `Workout` do tenant A apontar para um `TrainingPlan` do tenant B, porque nada impedia fisicamente que o `tenantId` da linha filha divergisse do `tenantId` do registro pai referenciado.

A correção usa **foreign keys compostas** `(childId, tenantId) → (parentId, tenantId)`, apoiadas por `@@unique([id, tenantId])` nas tabelas pai (`Student`, `TrainingPlan`, `Workout`). O PostgreSQL passa a rejeitar fisicamente qualquer `INSERT`/`UPDATE` cujo `tenantId` da linha filha não coincida com o `tenantId` do registro pai referenciado — não é mais possível criar o vínculo cruzado nem por engano na camada de aplicação, nem por acesso direto ao banco.

Relações protegidas por FK composta:

| Relação filha → pai | Campos compostos |
|---|---|
| `Workout → TrainingPlan` | `(trainingPlanId, tenantId) → TrainingPlan(id, tenantId)` |
| `WorkoutExercise → Workout` | `(workoutId, tenantId) → Workout(id, tenantId)` |
| `PlanAssignment → Student` | `(studentId, tenantId) → Student(id, tenantId)` |
| `PlanAssignment → TrainingPlan` | `(trainingPlanId, tenantId) → TrainingPlan(id, tenantId)` |
| `WorkoutSession → Student` | `(studentId, tenantId) → Student(id, tenantId)` |
| `WorkoutSession → Workout` | `(workoutId, tenantId) → Workout(id, tenantId)` |
| `Assessment → Student` | `(studentId, tenantId) → Student(id, tenantId)` |
| `StudentCharge → Student` | `(studentId, tenantId) → Student(id, tenantId)` |

`StudentCharge` e `SaasSubscription` continuam sem nenhuma coluna de chave estrangeira ou relação Prisma entre si — são estruturalmente independentes, conforme `ASSINATURA-SAAS.md`. Um teste automatizado (`isolation.integration.test.ts`) verifica essa ausência de relação diretamente no DMMF do Prisma.

Valores monetários (`StudentCharge.amountCents`) e de peso (`Assessment.weightGrams`) são armazenados como `Int` (menor unidade — centavos/gramas), nunca como ponto flutuante binário, conforme `docs/01-produto/REGRAS-DE-NEGOCIO.md`.

## Exercícios globais e privados (regra imposta por trigger, não por FK)

`WorkoutExercise → Exercise` **não** usa FK composta, porque `Exercise.tenantId` pode ser `NULL` (catálogo global, importado da API Ninjas, utilizável por qualquer tenant). Uma FK composta `(exerciseId, tenantId) → Exercise(id, tenantId)` exigiria igualdade exata e rejeitaria todo exercício global — o que é o comportamento errado.

PostgreSQL também não permite `CHECK constraint` que consulte outra tabela. A regra "um treino do tenant A não pode usar exercício privado do tenant B; um exercício global pode ser usado por qualquer tenant" é, portanto, imposta por **TRIGGER**:

```sql
CREATE OR REPLACE FUNCTION enforce_workout_exercise_tenant()
RETURNS TRIGGER AS $$
DECLARE
  exercise_tenant TEXT;
BEGIN
  SELECT "tenantId" INTO exercise_tenant FROM "exercises" WHERE "id" = NEW."exerciseId";
  IF exercise_tenant IS NOT NULL AND exercise_tenant <> NEW."tenantId" THEN
    RAISE EXCEPTION
      'workout_exercises.tenantId (%) nao corresponde ao tenant do exercicio privado (%)',
      NEW."tenantId", exercise_tenant;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workout_exercises_tenant_guard
BEFORE INSERT OR UPDATE ON "workout_exercises"
FOR EACH ROW EXECUTE FUNCTION enforce_workout_exercise_tenant();
```

Esse trigger está na migration `20260916000000_add_tenant_composite_constraints/migration.sql` como SQL puro — não é representável no Prisma Schema (o Prisma não tem uma primitiva de trigger). Ele é reaplicado a cada `prisma migrate deploy`/`migrate dev` porque faz parte do arquivo de migration versionado, mas **não aparece** se alguém rodar `prisma db pull` ou `prisma migrate diff` a partir do schema — qualquer alteração futura no modelo `WorkoutExercise`/`Exercise` deve preservar manualmente esse trigger na migration seguinte. Cobertura de teste: ver "Testes negativos" abaixo.

## Autores e atores (`Assessment.authorUserId`, `AuditEvent.actorUserId`) — lacuna conhecida

`Assessment.authorUserId` e `AuditEvent.actorUserId` permanecem como foreign key simples para `User` (`authorUserId → User.id`), **sem** nenhuma constraint física que garanta que esse usuário pertença ao `tenantId` do registro.

Isso é uma lacuna conhecida e deliberadamente não corrigida nesta rodada: `User` ainda não tem um modelo físico de *membership* — personal é dono de um tenant via `Tenant.ownerId`, aluno via `Student.userId`, mas não existe uma tabela genérica "este `User` pertence a este `Tenant`, com este papel" que pudesse ser referenciada por chave composta (o par `(User, Tenant)` não é 1:1 do ponto de vista de "quem pode agir sobre este tenant" — um personal também pode, futuramente, ter mais de uma forma de vínculo). Construir esse modelo de membership agora ampliaria o escopo desta História muito além do mínimo pedido, e antecipar decisões de autorização sem a prova técnica de autenticação correria o risco de ficar incompatível com o modelo real que a autenticação escolhida (Better Auth ou Clerk) impuser.

**Consequência prática:** hoje, nada no banco impede que um `Assessment` ou `AuditEvent` do tenant A tenha `authorUserId`/`actorUserId` apontando para um `User` que não é nem o personal (owner) nem um aluno (`Student.userId`) desse tenant A. Essa proteção depende da futura camada de autenticação/autorização (que também vai resolver a derivação real de `tenantId` a partir da sessão). `Assessment` e `AuditEvent` **não devem ser apresentados como integralmente protegidos** — apenas a relação com `Student`/`Tenant` (via `studentId`/`tenantId`) tem constraint física; a relação com o autor/ator não tem.

## O que a FIT-007 garante

- integridade estrutural das relações entre registros do **mesmo tenant** (FK composta rejeita fisicamente o vínculo cruzado nas 8 relações listadas acima);
- rejeição física de vínculo cruzado envolvendo exercícios privados (trigger);
- constraints de unicidade (`Tenant.ownerId`, `Student.userId`, `SaasSubscription.tenantId`, `(id, tenantId)` nas tabelas pai);
- separação estrutural entre `StudentCharge` e `SaasSubscription` (nenhuma FK/relação entre os dois);
- possibilidade de consultas escopadas por `tenantId` (índices em toda tabela de domínio).

## O que a FIT-007 ainda não garante

- autenticação;
- autorização de acesso;
- derivação do tenant a partir de uma sessão real (a estratégia de dados existe; a implementação depende da prova técnica de autenticação);
- **proteção automática contra uma consulta Prisma escrita sem filtro de tenant** — até a futura camada de autenticação/contexto existir, qualquer código com acesso direto ao `PrismaClient` que não inclua `tenantId` no `where` de uma consulta ainda pode ler registros de qualquer tenant. As constraints físicas desta História protegem a **integridade dos vínculos entre registros** (não se pode criar um registro filho apontando para um pai de outro tenant), mas não impedem uma leitura mal escrita de ignorar o filtro;
- isolamento por Row-Level Security — não implementado nesta História; o isolamento hoje depende de a camada de aplicação sempre filtrar por `tenantId` (disciplina de código), reforçada pelas constraints de integridade acima, mas não por RLS no PostgreSQL;
- associação autenticada entre usuário e tenant (ver "Autores e atores" acima).

Não se deve afirmar que "nenhum fluxo permite acesso entre tenants" com base apenas nos testes de consulta filtrada (`isolation.integration.test.ts`, suíte "consultas escopadas por tenant") — esses testes provam que uma consulta **já filtrada** por `tenantId` funciona corretamente, não que toda consulta possível seja filtrada.

## Migrations

- `prisma/migrations/20260915233539_init_multitenant_schema/migration.sql` — cria todas as tabelas, enums, índices e foreign keys do modelo físico inicial.
- `prisma/migrations/20260916000000_add_tenant_composite_constraints/migration.sql` — substitui as foreign keys simples por compostas nas 8 relações listadas acima e cria o trigger de exercícios privados/globais. Gerada com `prisma migrate diff --from-url ... --to-schema-datamodel prisma/schema.prisma --script` (não com `prisma migrate dev`, que exige terminal interativo neste ambiente) e aplicada com `prisma migrate deploy`.
- Aplicar em desenvolvimento: `npm run db:migrate` (roda `prisma migrate dev`, cria banco-sombra para validar o diff).
- Aplicar em CI/homologação (sem shadow database): `npm run db:migrate:deploy` (roda `prisma migrate deploy`).
- Reprodutibilidade validada nesta rodada: as duas migrations foram aplicadas em sequência, com sucesso, em um banco PostgreSQL vazio criado exclusivamente para essa validação (e removido depois).

### Rollback

Para a migration inicial, o rollback documentado é o `DROP` completo das tabelas/enums criados (ver histórico desta seção nas versões anteriores deste documento).

Para a migration `20260916000000_add_tenant_composite_constraints`, o rollback (apenas em desenvolvimento/teste) é:

```sql
DROP TRIGGER IF EXISTS workout_exercises_tenant_guard ON "workout_exercises";
DROP FUNCTION IF EXISTS enforce_workout_exercise_tenant();

ALTER TABLE "workouts" DROP CONSTRAINT "workouts_trainingPlanId_tenantId_fkey";
ALTER TABLE "workout_exercises" DROP CONSTRAINT "workout_exercises_workoutId_tenantId_fkey";
ALTER TABLE "plan_assignments" DROP CONSTRAINT "plan_assignments_studentId_tenantId_fkey";
ALTER TABLE "plan_assignments" DROP CONSTRAINT "plan_assignments_trainingPlanId_tenantId_fkey";
ALTER TABLE "workout_sessions" DROP CONSTRAINT "workout_sessions_studentId_tenantId_fkey";
ALTER TABLE "workout_sessions" DROP CONSTRAINT "workout_sessions_workoutId_tenantId_fkey";
ALTER TABLE "assessments" DROP CONSTRAINT "assessments_studentId_tenantId_fkey";
ALTER TABLE "student_charges" DROP CONSTRAINT "student_charges_studentId_tenantId_fkey";

DROP INDEX "workouts_id_tenantId_key";
DROP INDEX "training_plans_id_tenantId_key";
DROP INDEX "students_id_tenantId_key";
-- (recriar as FKs/índices simples da migration anterior, se o rollback completo for necessário)
```

Para migrations futuras, a política é: nunca editar uma migration já aplicada; reverter significa criar uma nova migration que desfaz a alteração (forward-only), ou restaurar a partir de backup em ambientes com dados reais (backup/retenção seguem pendentes — ver `DECISOES-PENDENTES.md`).

## Seeds

`prisma/seed.ts` cria dados **exclusivamente sintéticos**: 2 tenants fictícios, cada um com 1 personal (`User`) e 1 aluno (`Student`), 1 assinatura SaaS e 1 cobrança de aluno. Nenhum dado real de aluno ou personal é usado. Executar com `npm run db:seed` (idempotência: o script usa e-mails fixos — rodar mais de uma vez sobre a mesma base falha por unicidade; limpar as tabelas antes de rodar novamente em desenvolvimento).

## Testes de constraints e isolamento

`src/modules/tenancy/isolation.integration.test.ts` roda contra um banco de testes real (`fitos_test`, migrations aplicadas via `prisma migrate deploy`) e cobre quatro suítes:

1. **Consultas escopadas por tenant** (não é prova de isolamento físico — ver aviso no próprio arquivo de teste): `findMany`/`updateMany`/`deleteMany` com filtro de `tenantId` nunca afetam/retornam registro de outro tenant.
2. **Constraints de tenancy:** impede segundo tenant para o mesmo owner, impede vincular o mesmo aluno a um segundo tenant, impede segunda assinatura SaaS para o mesmo tenant.
3. **Integridade relacional composta por tenant (testes negativos reais, contra PostgreSQL):**
   - cobrança do tenant A vinculada ao aluno do tenant B → rejeitado;
   - plano do tenant A atribuído ao aluno do tenant B → rejeitado;
   - treino do tenant A vinculado ao plano do tenant B → rejeitado;
   - sessão com aluno e treino de tenants diferentes → rejeitado;
   - item de treino do tenant A usando exercício privado do tenant B → rejeitado (via trigger);
   - exercício global utilizado por um tenant diferente do seu (não se aplica, pois é global) → **permitido**, caso positivo de controle.
4. **Separação StudentCharge/SaasSubscription:** nenhuma relação Prisma entre os dois modelos (verificado no DMMF).

## Fora do escopo desta História

- Autenticação produtiva e o modelo físico de membership que ela exigirá (ver "Autores e atores" acima).
- UI funcional sobre este modelo.
- Cobrança real, API Ninjas real, Railway de produção.
- Row-Level Security no PostgreSQL.
- Qualquer feature completa de produto (Alunos, Treinos, Financeiro).
