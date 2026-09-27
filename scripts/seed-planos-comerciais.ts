/**
 * FIT-122 — comando administrativo que reconcilia a tabela `plans` com o
 * catálogo oficial (`src/modules/billing/planCatalog.ts`). Execução manual
 * apenas — nunca chamado pelo build ou deploy; `prisma/seed.ts` chama a
 * mesma função `ensurePlanCatalog` diretamente para o banco de
 * desenvolvimento, sem passar por este script.
 *
 * Idempotente: upsert por `slug`, seguro para rodar quantas vezes for
 * preciso em qualquer ambiente, inclusive produção.
 *
 * Uso:
 *   npm run planos:seed-comerciais
 */
import { PrismaClient } from "@prisma/client";
import { ensurePlanCatalog } from "../src/modules/billing/planCatalog";

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const plans = await ensurePlanCatalog(prisma);
    console.log(`[planos:seed-comerciais] ${plans.length} plano(s) reconciliado(s):`);
    for (const plan of plans) {
      console.log(`  - ${plan.slug} (${plan.audience}): ${plan.name}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[planos:seed-comerciais] falha não tratada:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
