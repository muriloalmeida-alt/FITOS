-- Ciclo de vida do exercício próprio (FIT-022): ativo/arquivado.
-- Aditiva: nenhuma coluna existente removida/alterada de tipo; nenhuma
-- migration anterior editada; os triggers de isolamento multi-tenant
-- permanecem intactos — esta migration não os toca.
CREATE TYPE "ExerciseStatus" AS ENUM ('ATIVO', 'ARQUIVADO');

ALTER TABLE "exercises" ADD COLUMN "status" "ExerciseStatus" NOT NULL DEFAULT 'ATIVO';

-- O DEFAULT físico de `updatedAt` (adicionado na migration anterior para
-- proteger um eventual ambiente com linhas pré-existentes) não é declarado
-- no schema.prisma (que só usa `@updatedAt`, gerido pela aplicação em cada
-- escrita) — removido aqui para eliminar o drift, sem efeito no
-- comportamento real: toda escrita via Prisma já define `updatedAt`.
ALTER TABLE "exercises" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- Duplicidade dentro do tenant (FIT-022): dois exercícios PRÓPRIOS do
-- mesmo tenant não podem ter o mesmo nome normalizado (minúsculas),
-- independentemente de estarem ativos ou arquivados — reativar um
-- exercício arquivado é o caminho correto para "reusar" o nome, em vez de
-- criar um novo com o mesmo nome. Índice único parcial (não representável
-- no Prisma Schema — mesma limitação já documentada para os TRIGGERs de
-- isolamento): só se aplica a `origin = 'PERSONAL'`, nunca a exercícios
-- globais (que já são deduplicados por `[origin, externalId]`).
CREATE UNIQUE INDEX "exercises_personal_tenant_name_key"
  ON "exercises" ("tenantId", lower("name"))
  WHERE "origin" = 'PERSONAL';
