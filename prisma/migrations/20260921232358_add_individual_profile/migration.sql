-- CreateEnum
CREATE TYPE "IndividualObjective" AS ENUM ('GANHAR_MASSA', 'PERDER_PESO', 'CONDICIONAMENTO_GERAL', 'SAUDE_E_BEM_ESTAR', 'OUTRO');

-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('INICIANTE', 'INTERMEDIARIO', 'AVANCADO');

-- CreateEnum
CREATE TYPE "WeeklyAvailability" AS ENUM ('UM_A_DOIS_DIAS', 'TRES_A_QUATRO_DIAS', 'CINCO_OU_MAIS_DIAS');

-- CreateTable
CREATE TABLE "individual_profiles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "objective" "IndividualObjective" NOT NULL,
    "experienceLevel" "ExperienceLevel" NOT NULL,
    "weeklyAvailability" "WeeklyAvailability" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "individual_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "individual_profiles_tenantId_key" ON "individual_profiles"("tenantId");

-- AddForeignKey
ALTER TABLE "individual_profiles" ADD CONSTRAINT "individual_profiles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
