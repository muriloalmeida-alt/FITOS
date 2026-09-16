-- Campos de catálogo em Exercise (FIT-021): espelham o contrato da
-- Exercises API (API Ninjas) — todos opcionais, preenchidos para exercícios
-- globais (origin = API_NINJAS) e, quando aplicável, também usados por
-- exercícios próprios (origin = PERSONAL, FIT-022).
--
-- Aditiva: nenhuma coluna existente é removida ou tem seu tipo alterado;
-- nenhuma migration anterior é editada; os triggers de isolamento
-- multi-tenant (`enforce_workout_exercise_tenant`,
-- `enforce_exercise_tenant_immutability`, migration
-- `20260916000000_add_tenant_composite_constraints`) permanecem intactos —
-- esta migration não os toca.
--
-- `updatedAt` é adicionada como NOT NULL sem backfill explícito porque a
-- tabela `exercises` está vazia em todos os ambientes conhecidos neste
-- momento (confirmado antes de gerar esta migration); se algum ambiente
-- tiver linhas pré-existentes, o valor DEFAULT abaixo cobre o backfill
-- automaticamente.
ALTER TABLE "exercises"
  ADD COLUMN "type" TEXT,
  ADD COLUMN "muscle" TEXT,
  ADD COLUMN "equipments" TEXT,
  ADD COLUMN "difficulty" TEXT,
  ADD COLUMN "instructions" TEXT,
  ADD COLUMN "safetyInfo" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Chave de deduplicação: a Exercises API não retorna um identificador
-- estável, então `externalId` é calculado pelo FitOS (hash determinístico
-- de nome+tipo+músculo+equipamento+dificuldade normalizados) para
-- exercícios API_NINJAS. Múltiplas linhas PERSONAL com externalId nulo não
-- colidem: o PostgreSQL trata cada NULL como distinto em índice único.
CREATE UNIQUE INDEX "exercises_origin_externalId_key" ON "exercises"("origin", "externalId");
